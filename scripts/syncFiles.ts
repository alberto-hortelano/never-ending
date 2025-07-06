#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface SyncOptions {
    source: string;
    destination: string;
    extensions: string[];
    verbose: boolean;
    dryRun: boolean;
    watch: boolean;
}

// Parse command line arguments without external libraries
function parseCommandLineArgs(): SyncOptions {
    const args = process.argv.slice(2);
    const options: SyncOptions = {
        source: '',
        destination: '',
        extensions: [],
        verbose: false,
        dryRun: false,
        watch: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '-s':
            case '--source':
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    options.source = args[++i];
                }
                break;

            case '-d':
            case '--destination':
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    options.destination = args[++i];
                }
                break;

            case '-e':
            case '--extensions':
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    const extensionsStr = args[++i];
                    options.extensions = extensionsStr.split(',').map(ext =>
                        ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
                    );
                }
                break;

            case '-v':
            case '--verbose':
                options.verbose = true;
                break;

            case '--dry-run':
                options.dryRun = true;
                break;

            case '--watch':
                options.watch = true;
                break;

            default:
                console.error(`Error: Unknown option '${arg}'`);
        }
    }

    // Validate that source and destination paths exist
    try {
        if (!fs.existsSync(options.source)) {
            console.error(`Error: Source directory '${options.source}' does not exist`);
        }

        const sourceStats = fs.statSync(options.source);
        if (!sourceStats.isDirectory()) {
            console.error(`Error: Source path '${options.source}' is not a directory`);
        }
    } catch (err) {
        console.error(`Error accessing source directory: ${err}`);
    }

    return options;
}

const options = parseCommandLineArgs();
options.extensions = options.extensions.map(ext => ext.startsWith('.') ? ext : `.${ext}`);

// Function to calculate MD5 hash of a file
async function getFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);

        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

// Function to check if a file has one of the specified extensions
function hasValidExtension(filePath: string, extensions: string[]): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return extensions.includes(ext);
}

// Function to check if a directory contains any files with valid extensions (recursively)
function directoryContainsTargetFiles(dirPath: string, extensions: string[]): boolean {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            
            if (entry.isFile() && hasValidExtension(entry.name, extensions)) {
                return true;
            } else if (entry.isDirectory()) {
                if (directoryContainsTargetFiles(entryPath, extensions)) {
                    return true;
                }
            }
        }
        
        return false;
    } catch (err) {
        console.error(`Error checking directory ${dirPath}:`, err);
        return false;
    }
}

// Function to create directory if it doesn't exist
function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        if (options.verbose) {
            console.log(`Created directory: ${dirPath}`);
        }
    }
}

// Function to copy a file
async function copyFile(sourcePath: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(sourcePath);
        const writeStream = fs.createWriteStream(destPath);

        readStream.on('error', err => reject(err));
        writeStream.on('error', err => reject(err));
        writeStream.on('finish', () => resolve());

        readStream.pipe(writeStream);
    });
}

// Function to recursively clean up empty directories
async function cleanupDirectory(dirPath: string): Promise<void> {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                await cleanupDirectory(entryPath);
                
                // Try to remove if empty
                try {
                    fs.rmdirSync(entryPath);
                    if (options.verbose) {
                        console.log(`Removed empty directory: ${entryPath}`);
                    }
                } catch {
                    // Directory not empty, that's fine
                }
            }
        }
    } catch (err) {
        console.error(`Error cleaning up directory ${dirPath}:`, err);
    }
}

// Function to process directories recursively
async function processDirectory(sourcePath: string, destPath: string): Promise<void> {
    try {
        // Check if this directory contains any target files
        if (!directoryContainsTargetFiles(sourcePath, options.extensions)) {
            if (options.verbose) {
                console.log(`Skipping directory (no target files): ${sourcePath}`);
            }
            return;
        }

        // Create destination directory if it doesn't exist
        ensureDirectoryExists(destPath);

        // Read source directory
        const entries = fs.readdirSync(sourcePath, { withFileTypes: true });

        // Process each entry
        for (const entry of entries) {
            const srcEntryPath = path.join(sourcePath, entry.name);
            const destEntryPath = path.join(destPath, entry.name);

            if (entry.isDirectory()) {
                // Recursively process subdirectories
                if (options.verbose) {
                    console.log(`Processing directory: ${srcEntryPath}`);
                }
                await processDirectory(srcEntryPath, destEntryPath);
            } else if (entry.isFile() && hasValidExtension(entry.name, options.extensions)) {
                // Process files with valid extensions
                let shouldCopy = true;

                if (fs.existsSync(destEntryPath)) {
                    // Compare file hashes to determine if copy is needed
                    const srcHash = await getFileHash(srcEntryPath);
                    const destHash = await getFileHash(destEntryPath);

                    if (srcHash === destHash) {
                        if (options.verbose) {
                            console.log(`File unchanged (skipping): ${entry.name}`);
                        }
                        shouldCopy = false;
                    }
                }

                if (shouldCopy) {
                    if (options.dryRun) {
                        console.log(`Would copy: ${srcEntryPath} -> ${destEntryPath}`);
                    } else {
                        await copyFile(srcEntryPath, destEntryPath);
                        if (options.verbose) {
                            console.log(`Copied: ${srcEntryPath} -> ${destEntryPath}`);
                        }
                    }
                }
            } else if (options.verbose) {
                console.log(`Skipping non-matching file: ${srcEntryPath}`);
            }
        }

        // Handle file deletions (files in destination that don't exist in source)
        if (!options.dryRun) {
            const destEntries = fs.readdirSync(destPath, { withFileTypes: true });

            for (const destEntry of destEntries) {
                const destEntryPath = path.join(destPath, destEntry.name);
                const srcEntryPath = path.join(sourcePath, destEntry.name);

                if (destEntry.isFile() && hasValidExtension(destEntry.name, options.extensions)) {
                    if (!fs.existsSync(srcEntryPath)) {
                        fs.unlinkSync(destEntryPath);
                        if (options.verbose) {
                            console.log(`Deleted: ${destEntryPath} (not in source)`);
                        }
                    }
                } else if (destEntry.isDirectory()) {
                    // Remove directories that either don't exist in source or don't contain target files
                    if (!fs.existsSync(srcEntryPath) || !directoryContainsTargetFiles(srcEntryPath, options.extensions)) {
                        // Recursively clean up subdirectory first
                        await cleanupDirectory(destEntryPath);
                        
                        // Try to remove the directory if it's empty
                        try {
                            fs.rmdirSync(destEntryPath);
                            if (options.verbose) {
                                console.log(`Removed empty directory: ${destEntryPath}`);
                            }
                        } catch {
                            // Directory might not be empty, which is fine
                            if (options.verbose) {
                                console.log(`Could not remove directory (might not be empty): ${destEntryPath}`);
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(`Error processing directory ${sourcePath}:`, err);
        throw err;
    }
}

// Function to watch for file changes and trigger synchronization
function watchForChanges(sourcePath: string, destPath: string): void {
    // Perform initial sync
    console.log(`Starting initial folder sync from ${sourcePath} to ${destPath}`);
    console.log(`Only syncing files with extensions: ${options.extensions.join(', ')}`);

    if (options.dryRun) {
        console.log('DRY RUN MODE: No changes will be made');
    }

    // Create recursive watcher function
    function setupWatcher(sourceDir: string, destDir: string): void {
        // Watch the current directory
        fs.watch(sourceDir, { persistent: true }, async (eventType, filename) => {
            if (!filename) return;

            const srcFilePath = path.join(sourceDir, filename);
            const destFilePath = path.join(destDir, filename);

            try {
                // Check if the file/directory still exists (to handle deletion events)
                const exists = fs.existsSync(srcFilePath);

                if (exists) {
                    const stats = fs.statSync(srcFilePath);

                    if (stats.isDirectory()) {
                        // Make sure the destination directory exists
                        ensureDirectoryExists(destFilePath);

                        // No need to do anything else for directories - their contents will be watched separately
                        if (options.verbose) {
                            console.log(`Directory changed: ${srcFilePath}`);
                        }
                    } else if (stats.isFile() && hasValidExtension(filename, options.extensions)) {
                        // For files with valid extensions, sync them
                        console.log(`File changed: ${srcFilePath}`);

                        let shouldCopy = true;

                        if (fs.existsSync(destFilePath)) {
                            // Compare file hashes
                            const srcHash = await getFileHash(srcFilePath);
                            const destHash = await getFileHash(destFilePath);

                            if (srcHash === destHash) {
                                shouldCopy = false;
                            }
                        }

                        if (shouldCopy) {
                            if (options.dryRun) {
                                console.log(`Would copy: ${srcFilePath} -> ${destFilePath}`);
                            } else {
                                await copyFile(srcFilePath, destFilePath);
                                if (options.verbose) {
                                    console.log(`Copied: ${srcFilePath} -> ${destFilePath}`);
                                }
                            }
                        }
                    }
                } else if (fs.existsSync(destFilePath)) {
                    // Source was deleted, delete from destination if it's a matching file
                    const isFile = fs.statSync(destFilePath).isFile();

                    if (isFile && hasValidExtension(filename, options.extensions)) {
                        if (options.dryRun) {
                            console.log(`Would delete: ${destFilePath} (removed from source)`);
                        } else {
                            fs.unlinkSync(destFilePath);
                            console.log(`Deleted: ${destFilePath} (removed from source)`);
                        }
                    }
                }
            } catch (err) {
                // Handle errors (e.g., file might be temporarily unavailable)
                console.error(`Error processing change for ${filename}:`, err);
            }
        });

        // Recursively watch subdirectories
        try {
            const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const srcSubDir = path.join(sourceDir, entry.name);
                    const destSubDir = path.join(destDir, entry.name);

                    // Create the destination subdirectory if it doesn't exist
                    ensureDirectoryExists(destSubDir);

                    // Set up watcher for this subdirectory
                    setupWatcher(srcSubDir, destSubDir);
                }
            }
        } catch (err) {
            console.error(`Error setting up watchers in ${sourceDir}:`, err);
        }
    }

    // Start the recursive watching process
    setupWatcher(sourcePath, destPath);
    console.log(`Watching for changes in ${sourcePath}...`);
}

// Main function
async function main(): Promise<void> {
    try {
        // Update options to include watch mode
        const watchMode = process.argv.includes('--watch') || process.argv.includes('-w');

        // Perform initial sync
        await processDirectory(options.source, options.destination);
        console.log('Initial synchronization completed successfully');

        // Set up file watching if requested
        if (watchMode) {
            watchForChanges(options.source, options.destination);
        } else {
            console.log('Sync completed. Use --watch or -w flag to enable continuous watching for changes.');
        }
    } catch (err) {
        console.error('Synchronization failed:', err);
        process.exit(1);
    }
}
// Execute the main function
main();
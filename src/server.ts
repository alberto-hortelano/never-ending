import express from 'express';
import { dirname, resolve, extname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = resolve(__dirname, '../public');

const app = express();
const port = 3000;

app.use((req, res, next) => {
    if (req.url.startsWith('/js')) {
        if (!extname(req.url)) {
            if (existsSync(join(publicDir, req.url + '.js'))) {
                req.url += '.js';
            } else {
                const dirPath = req.url.endsWith('/') ? req.url : req.url + '/';
                const indexPath = join(publicDir, dirPath, 'index.js');

                if (existsSync(indexPath)) {
                    req.url = dirPath + 'index.js';
                    return res.redirect(302, join(dirPath, 'index.js'));
                } else {
                    console.log('>>> - EEEEEEE - indexPath:', indexPath, join(dirPath, 'index.js'))
                }
            }
        }
    }

    next();
});

// Serve static files
app.use(express.static(publicDir, {
    dotfiles: 'ignore'
}));

app.listen(port, () => {
    console.log(`Static server running at http://localhost:${port}`);
});

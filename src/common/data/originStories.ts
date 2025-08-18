import type { IOriginStory } from '../interfaces';

export const originStories: IOriginStory[] = [
    {
        id: 'deserter',
        name: 'The Deserter',
        nameES: 'El Desertor',
        description: 'An ex-soldier fleeing a military unit that turned rogue. You escaped with sensitive intel and a loyal service droid.',
        descriptionES: 'Un ex-soldado huyendo de una unidad militar que se volvió rebelde. Escapaste con información sensible y un droide de servicio leal.',
        startingLocation: 'Stolen Military Cruiser',
        startingCompanion: {
            name: 'Data',
            type: 'robot',
            description: 'A loyal golden service droid with advanced tactical programming'
        },
        initialInventory: ['military_rifle', 'combat_armor', 'encrypted_datapad'],
        factionRelations: {
            'rogue_military': -80,
            'rebel_coalition': 20,
            'free_worlds': 0,
            'syndicate': -20,
            'technomancers': 0
        },
        specialTraits: ['combat_veteran', 'wanted_fugitive', 'tactical_expertise'],
        narrativeHooks: [
            'Pursued by former unit',
            'Carries military secrets',
            'Questions of loyalty and duty'
        ]
    },
    {
        id: 'scavenger',
        name: 'The Scavenger',
        nameES: 'El Carroñero',
        description: 'Leader of a salvage crew who discovered pre-collapse technology. Your find attracted unwanted attention.',
        descriptionES: 'Líder de un equipo de salvamento que descubrió tecnología pre-colapso. Tu hallazgo atrajo atención no deseada.',
        startingLocation: 'Modified Salvage Vessel',
        startingCompanion: {
            name: 'Rusty',
            type: 'robot',
            description: 'A cobbled-together repair droid with surprising capabilities'
        },
        initialInventory: ['plasma_cutter', 'scanner_array', 'ancient_artifact'],
        factionRelations: {
            'rogue_military': 0,
            'rebel_coalition': 0,
            'free_worlds': 30,
            'syndicate': -40,
            'technomancers': 50
        },
        specialTraits: ['tech_savvy', 'resourceful', 'artifact_bearer'],
        narrativeHooks: [
            'Ancient technology mystery',
            'Corporate exploitation',
            'Survival through ingenuity'
        ]
    },
    {
        id: 'investigator',
        name: 'The Investigator',
        nameES: 'El Investigador',
        description: 'A detective tracking syndicate operations across the galaxy. Your investigation uncovered a conspiracy.',
        descriptionES: 'Un detective rastreando operaciones del sindicato. Tu investigación descubrió una conspiración.',
        startingLocation: 'Undercover Transport Ship',
        startingCompanion: {
            name: 'VI-GO',
            type: 'robot',
            description: 'An analysis droid with advanced forensic capabilities'
        },
        initialInventory: ['concealed_pistol', 'evidence_scanner', 'syndicate_dossier'],
        factionRelations: {
            'rogue_military': 10,
            'rebel_coalition': 20,
            'free_worlds': 40,
            'syndicate': -60,
            'technomancers': 0
        },
        specialTraits: ['keen_observer', 'undercover_identity', 'information_network'],
        narrativeHooks: [
            'Uncovering corruption',
            'Justice vs survival',
            'Web of conspiracies'
        ]
    },
    {
        id: 'rebel',
        name: 'The Rebel',
        nameES: 'El Rebelde',
        description: 'A freedom fighter on a sabotage mission gone wrong. Now you must regroup and continue the fight.',
        descriptionES: 'Un luchador por la libertad en una misión de sabotaje fallida. Ahora debes reagruparte y continuar la lucha.',
        startingLocation: 'Captured Enemy Frigate',
        startingCompanion: {
            name: 'SPARK',
            type: 'robot',
            description: 'A combat droid reprogrammed for the rebellion'
        },
        initialInventory: ['explosives', 'rebel_uniform', 'resistance_codes'],
        factionRelations: {
            'rogue_military': -50,
            'rebel_coalition': 80,
            'free_worlds': 50,
            'syndicate': -30,
            'technomancers': 10
        },
        specialTraits: ['guerrilla_tactics', 'idealist', 'marked_terrorist'],
        narrativeHooks: [
            'Fighting oppression',
            'Cost of revolution',
            'Building alliances'
        ]
    },
    {
        id: 'survivor',
        name: 'The Survivor',
        nameES: 'El Superviviente',
        description: 'A colony refugee whose home was destroyed. Seeking a new beginning while haunted by the past.',
        descriptionES: 'Un refugiado colonial cuyo hogar fue destruido. Buscando un nuevo comienzo mientras el pasado te persigue.',
        startingLocation: 'Refugee Transport',
        startingCompanion: {
            name: 'Medical-7',
            type: 'robot',
            description: 'A medical droid that saved your life during the evacuation'
        },
        initialInventory: ['survival_kit', 'colony_records', 'family_heirloom'],
        factionRelations: {
            'rogue_military': -20,
            'rebel_coalition': 10,
            'free_worlds': 60,
            'syndicate': 0,
            'technomancers': 0
        },
        specialTraits: ['resilient', 'traumatized', 'community_builder'],
        narrativeHooks: [
            'Finding new home',
            'Uncovering destruction cause',
            'Rebuilding from ashes'
        ]
    }
];

export const factions = {
    'rogue_military': {
        id: 'rogue_military',
        name: 'Rogue Military Units',
        nameES: 'Unidades Militares Rebeldes',
        description: 'Former imperial forces turned mercenary or criminal'
    },
    'rebel_coalition': {
        id: 'rebel_coalition',
        name: 'Rebel Coalition',
        nameES: 'Coalición Rebelde',
        description: 'Fragmented resistance fighting for freedom'
    },
    'free_worlds': {
        id: 'free_worlds',
        name: 'Free Worlds Alliance',
        nameES: 'Alianza de Mundos Libres',
        description: 'Independent planets resisting control'
    },
    'syndicate': {
        id: 'syndicate',
        name: 'The Syndicate',
        nameES: 'El Sindicato',
        description: 'Organized crime network controlling trade routes'
    },
    'technomancers': {
        id: 'technomancers',
        name: 'Technomancers',
        nameES: 'Tecnomantes',
        description: 'Tech-obsessed cult hoarding pre-collapse technology'
    }
};
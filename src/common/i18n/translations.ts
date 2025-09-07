export interface TranslationKeys {
  // Main Menu
  'menu.singlePlayer': string;
  'menu.multiplayer': string;
  'menu.createCharacter': string;
  'menu.settings': string;
  
  // Character Creator
  'character.create': string;
  'character.createTitle': string;
  'character.name': string;
  'character.race': string;
  'character.races.human': string;
  'character.races.alien': string;
  'character.races.robot': string;
  'character.actions': string;
  'character.colors': string;
  'character.equipment': string;
  'character.abilities': string;
  'character.description': string;
  'character.skin': string;
  'character.helmet': string;
  'character.suit': string;
  'character.primary': string;
  'character.secondary': string;
  'character.idle': string;
  'character.walk': string;
  'character.shoot': string;
  'character.slash': string;
  'character.death': string;
  'character.weight': string;
  'character.budget': string;
  'character.weapons': string;
  'character.items': string;
  'character.points': string;
  'character.moveCost': string;
  'character.fireCost': string;
  'character.meleeCost': string;
  'character.visionRange': string;
  'character.actionPoints': string;
  'character.baseDamage': string;
  'character.shootingAccuracy': string;
  'character.meleeAccuracy': string;
  'character.armor': string;
  'character.cancel': string;
  'character.confirm': string;
  'character.rotate': string;
  'character.presets': string;
  'character.none': string;
  'character.credits': string;
  'character.namePlaceholder': string;
  'character.descriptionPlaceholder': string;
  'character.abilitiesNote': string;
  'character.pointsLabel': string;
  
  // Conversation
  'conversation.loading': string;
  'conversation.typeResponse': string;
  'conversation.send': string;
  'conversation.ended': string;
  'conversation.retry': string;
  'conversation.actionRequired': string;
  'conversation.yourResponse': string;
  'conversation.observing': string;
  'conversation.aiExchange': string;
  'conversation.previous': string;
  'conversation.next': string;
  'conversation.interrupt': string;
  'conversation.continueListen': string;
  'conversation.narrator': string;
  'conversation.storyContinues': string;
  
  // Top Bar
  'topbar.campaign': string;
  'topbar.map': string;
  'topbar.actionPoints': string;
  'topbar.currentTurn': string;
  'topbar.endTurn': string;
  'topbar.loading': string;
  
  // Bottom Bar
  'bottombar.tapToMove': string;
  'bottombar.holdToRotate': string;
  'bottombar.pinchToZoom': string;
  
  // Popup
  'popup.actions': string;
  'popup.pin': string;
  'popup.unpin': string;
  'popup.close': string;
  
  // Story Journal
  'journal.mainMission': string;
  'journal.sideMissions': string;
  'journal.characters': string;
  'journal.notes': string;
  'journal.empty': string;
  'journal.noMainMission': string;
  'journal.noSideMissions': string;
  'journal.noCharacters': string;
  'journal.noNotes': string;
  
  // Select Character
  'select.title': string;
  'select.choose': string;
  'select.noOneToTalk': string;
  
  // Origin Selection
  'origin.title': string;
  'origin.subtitle': string;
  'origin.mercenary': string;
  'origin.mercenaryDesc': string;
  'origin.detective': string;
  'origin.detectiveDesc': string;
  'origin.explorer': string;
  'origin.explorerDesc': string;
  
  // Common
  'common.loading': string;
  'common.error': string;
  'common.ok': string;
  'common.cancel': string;
  'common.yes': string;
  'common.no': string;
  'common.accept': string;
  'common.reject': string;
  'common.save': string;
  'common.load': string;
  'common.delete': string;
  'common.confirm': string;
  'common.back': string;
  'common.next': string;
  'common.skip': string;
  'common.start': string;
  'common.continue': string;
  'common.retry': string;
  'common.quit': string;
  'common.close': string;
  'common.open': string;
  'common.select': string;
  'common.selected': string;
  'common.available': string;
  'common.unavailable': string;
  'common.locked': string;
  'common.unlocked': string;
  'common.enabled': string;
  'common.disabled': string;
  'common.on': string;
  'common.off': string;
  
  // Settings
  'settings.title': string;
  'settings.language': string;
  'settings.sound': string;
  'settings.music': string;
  'settings.comingSoon': string;
  'settings.effects': string;
  'settings.graphics': string;
  'settings.quality': string;
  'settings.low': string;
  'settings.medium': string;
  'settings.high': string;
  'settings.ultra': string;
  
  // Error Messages
  'error.loadFailed': string;
  'error.saveFailed': string;
  'error.connectionLost': string;
  'error.invalidAction': string;
  'error.notEnoughAP': string;
  'error.targetOutOfRange': string;
  'error.pathBlocked': string;
  'error.invalidTarget': string;
  'error.characterDead': string;
  'error.gameOver': string;
  
  // Inventory
  'inventory.title': string;
  'inventory.equipped': string;
  'inventory.primary': string;
  'inventory.secondary': string;
  'inventory.weapons': string;
  'inventory.otherItems': string;
  'inventory.empty': string;
  'inventory.emptySlot': string;
  'inventory.equip': string;
  'inventory.weight': string;
  
  // Actions
  'action.aim': string;
  'action.requiresRangedWeapon': string;
  'action.move': string;
  'action.shoot': string;
  'action.reload': string;
  'action.melee': string;
  'action.closeCombat': string;
  
  // Select Character
  'select.noCharacters': string;
  
  // Multiplayer
  'multiplayer.lobby': string;
  'multiplayer.joinGame': string;
  'multiplayer.createGame': string;
  'multiplayer.waiting': string;
  'multiplayer.players': string;
  'multiplayer.enterName': string;
  'multiplayer.roomName': string;
  'multiplayer.roomFull': string;
  'multiplayer.roomNotFound': string;
  'multiplayer.connectionFailed': string;
  
  // Misc UI
  'ui.wall': string;
  'ui.hp': string;
  'ui.lockedDoor': string;
  'ui.openDoor': string;
  'ui.closedDoor': string;
  'ui.doorStateLabel': string;
  'ui.openState': string;
  'ui.closedState': string;
  'ui.lockedState': string;
  'ui.door': string;
  'ui.exitDoor': string;
  'ui.mission': string;
  'ui.damage': string;
  'ui.range': string;
  'ui.weight': string;
  'ui.cost': string;
  
  // Defense Wheel
  'defense.title': string;
  'defense.attackerInfo': string;
  'defense.defenderInfo': string;
  'defense.selectDefense': string;
  'defense.perfectBlock': string;
  'defense.goodDefense': string;
  'defense.partialDefense': string;
  'defense.poorDefense': string;
  'defense.noDamage': string;
  'defense.lowDamage': string;
  'defense.mediumDamage': string;
  'defense.highDamage': string;
  
  // Loading
  'loading.pleaseWait': string;
  'loading.connecting': string;
  'loading.preparing': string;
}

export const translations: Record<string, TranslationKeys> = {
  en: {
    // Main Menu
    'menu.singlePlayer': 'Single Player',
    'menu.multiplayer': 'Multiplayer',
    'menu.createCharacter': 'Create Character',
    'menu.settings': 'Settings',
    
    // Character Creator
    'character.create': 'Create Your Character',
    'character.createTitle': 'Create Your Character',
    'character.name': 'Name',
    'character.race': 'Race',
    'character.races.human': 'Human',
    'character.races.alien': 'Alien',
    'character.races.robot': 'Robot',
    'character.actions': 'Actions',
    'character.colors': 'Colors',
    'character.equipment': 'Equipment',
    'character.abilities': 'Abilities',
    'character.description': 'Description',
    'character.skin': 'Skin',
    'character.helmet': 'Helmet',
    'character.suit': 'Suit',
    'character.primary': 'Primary',
    'character.secondary': 'Secondary',
    'character.idle': 'Idle',
    'character.walk': 'Walk',
    'character.shoot': 'Shoot',
    'character.slash': 'Slash',
    'character.death': 'Death',
    'character.weight': 'Weight:',
    'character.budget': 'Budget:',
    'character.weapons': 'Weapons',
    'character.items': 'Items',
    'character.points': 'points',
    'character.moveCost': 'Cost to move one tile',
    'character.fireCost': 'Cost to fire weapon',
    'character.meleeCost': 'Cost to melee attack',
    'character.visionRange': 'Vision range',
    'character.actionPoints': 'Action points',
    'character.baseDamage': 'Base damage',
    'character.shootingAccuracy': 'Shooting accuracy',
    'character.meleeAccuracy': 'Melee accuracy',
    'character.armor': 'Armor',
    'character.cancel': 'Cancel',
    'character.confirm': 'Create Character',
    'character.rotate': 'Rotate',
    'character.presets': 'Presets',
    'character.none': 'None',
    'character.credits': 'credits',
    'character.namePlaceholder': 'Enter character name',
    'character.descriptionPlaceholder': 'Describe your character...',
    'character.abilitiesNote': 'Lower costs mean better abilities. Distribute points wisely!',
    'character.pointsLabel': 'points',
    
    // Conversation
    'conversation.loading': 'Loading conversation...',
    'conversation.typeResponse': 'Or type your own response...',
    'conversation.send': 'Send',
    'conversation.ended': 'Conversation ended',
    'conversation.retry': 'Retry',
    'conversation.actionRequired': 'Action required',
    'conversation.yourResponse': 'Your response:',
    'conversation.observing': 'You are observing',
    'conversation.aiExchange': 'AI Conversation - Exchange',
    'conversation.previous': 'Previous',
    'conversation.next': 'Next',
    'conversation.interrupt': 'Interrupt',
    'conversation.continueListen': 'Continue Listening',
    'conversation.narrator': 'Narrator',
    'conversation.storyContinues': 'The story continues...',
    
    // Top Bar
    'topbar.campaign': 'Campaign',
    'topbar.map': 'Map',
    'topbar.actionPoints': 'Action Points:',
    'topbar.currentTurn': 'Current Turn:',
    'topbar.endTurn': 'End Turn',
    'topbar.loading': 'Loading...',
    
    // Bottom Bar
    'bottombar.tapToMove': '👆 Tap to move',
    'bottombar.holdToRotate': '👆 Hold to rotate',
    'bottombar.pinchToZoom': '🤏 Pinch to zoom',
    
    // Popup
    'popup.actions': 'Actions',
    'popup.pin': 'Pin popup',
    'popup.unpin': 'Unpin popup',
    'popup.close': 'Close popup',
    
    // Story Journal
    'journal.mainMission': 'Main Mission',
    'journal.sideMissions': 'Side Missions',
    'journal.characters': 'Characters',
    'journal.notes': 'Notes',
    'journal.empty': 'Empty',
    'journal.noMainMission': 'No main mission active',
    'journal.noSideMissions': 'No side missions available',
    'journal.noCharacters': 'No characters met',
    'journal.noNotes': 'No notes recorded',
    
    // Select Character
    'select.title': 'Select Your Character',
    'select.choose': 'Choose',
    'select.noOneToTalk': 'No one else is around to talk to',
    
    // Origin Selection
    'origin.title': 'Choose Your Origin',
    'origin.subtitle': 'Your past defines your path...',
    'origin.mercenary': 'Mercenary',
    'origin.mercenaryDesc': 'Battle-hardened warrior with combat expertise',
    'origin.detective': 'Detective',
    'origin.detectiveDesc': 'Sharp investigator with keen observation skills',
    'origin.explorer': 'Explorer',
    'origin.explorerDesc': 'Adventurous soul with survival instincts',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.ok': 'OK',
    'common.cancel': 'Cancel',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.accept': 'Accept',
    'common.reject': 'Reject',
    'common.save': 'Save',
    'common.load': 'Load',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.skip': 'Skip',
    'common.start': 'Start',
    'common.continue': 'Continue',
    'common.retry': 'Retry',
    'common.quit': 'Quit',
    'common.close': 'Close',
    'common.open': 'Open',
    'common.select': 'Select',
    'common.selected': 'Selected',
    'common.available': 'Available',
    'common.unavailable': 'Unavailable',
    'common.locked': 'Locked',
    'common.unlocked': 'Unlocked',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'common.on': 'On',
    'common.off': 'Off',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.sound': 'Sound',
    'settings.music': 'Music',
    'settings.comingSoon': 'More settings coming soon...',
    'settings.effects': 'Effects',
    'settings.graphics': 'Graphics',
    'settings.quality': 'Quality',
    'settings.low': 'Low',
    'settings.medium': 'Medium',
    'settings.high': 'High',
    'settings.ultra': 'Ultra',
    
    // Error Messages
    'error.loadFailed': 'Failed to load game',
    'error.saveFailed': 'Failed to save game',
    'error.connectionLost': 'Connection lost',
    'error.invalidAction': 'Invalid action',
    'error.notEnoughAP': 'Not enough action points',
    'error.targetOutOfRange': 'Target out of range',
    'error.pathBlocked': 'Path is blocked',
    'error.invalidTarget': 'Invalid target',
    'error.characterDead': 'Character is dead',
    'error.gameOver': 'Game Over',
    
    // Inventory
    'inventory.title': 'Inventory',
    'inventory.equipped': 'Equipped Weapons',
    'inventory.primary': 'Primary',
    'inventory.secondary': 'Secondary',
    'inventory.weapons': 'Weapons',
    'inventory.otherItems': 'Other Items',
    'inventory.empty': 'Your inventory is empty',
    'inventory.emptySlot': 'Empty',
    'inventory.equip': 'Equip',
    'inventory.weight': 'Weight',
    
    // Actions
    'action.aim': 'Aim',
    'action.requiresRangedWeapon': 'Requires ranged weapon',
    'action.move': 'Move',
    'action.shoot': 'Shoot',
    'action.reload': 'Reload',
    'action.melee': 'Melee',
    'action.closeCombat': 'Close Combat',
    
    // Select Character
    'select.noCharacters': 'No characters available',
    
    // Multiplayer
    'multiplayer.lobby': 'Multiplayer Lobby',
    'multiplayer.joinGame': 'Join Game',
    'multiplayer.createGame': 'Create Game',
    'multiplayer.waiting': 'Waiting for players...',
    'multiplayer.players': 'Players',
    'multiplayer.enterName': 'Enter your name',
    'multiplayer.roomName': 'Room name',
    'multiplayer.roomFull': 'Room is full',
    'multiplayer.roomNotFound': 'Room not found',
    'multiplayer.connectionFailed': 'Failed to connect to server',
    
    // Misc UI
    'ui.wall': 'Wall',
    'ui.hp': 'HP',
    'ui.lockedDoor': 'Locked door',
    'ui.openDoor': 'Open door',
    'ui.closedDoor': 'Closed door',
    'ui.doorStateLabel': 'State',
    'ui.openState': 'Open',
    'ui.closedState': 'Closed',
    'ui.lockedState': 'Locked',
    'ui.door': 'Door',
    'ui.exitDoor': 'Exit',
    'ui.mission': 'Mission',
    'ui.damage': 'dmg',
    'ui.range': 'range',
    'ui.weight': 'kg',
    'ui.cost': '¢',
    
    // Defense Wheel
    'defense.title': 'Defend Against Attack!',
    'defense.attackerInfo': 'attacks with',
    'defense.defenderInfo': 'defends with',
    'defense.selectDefense': 'Select your defense:',
    'defense.perfectBlock': 'Perfect Block',
    'defense.goodDefense': 'Good Defense',
    'defense.partialDefense': 'Partial Defense',
    'defense.poorDefense': 'Poor Defense',
    'defense.noDamage': '0 damage',
    'defense.lowDamage': '33% damage',
    'defense.mediumDamage': '66% damage',
    'defense.highDamage': '100% damage',
    
    // Loading
    'loading.pleaseWait': 'Please wait...',
    'loading.connecting': 'Connecting...',
    'loading.preparing': 'Preparing game...',
  },
  
  es: {
    // Main Menu
    'menu.singlePlayer': 'Un Jugador',
    'menu.multiplayer': 'Multijugador',
    'menu.createCharacter': 'Crear Personaje',
    'menu.settings': 'Configuración',
    
    // Character Creator
    'character.create': 'Crea Tu Personaje',
    'character.createTitle': 'Crea Tu Personaje',
    'character.name': 'Nombre',
    'character.race': 'Raza',
    'character.races.human': 'Humano',
    'character.races.alien': 'Alienígena',
    'character.races.robot': 'Robot',
    'character.actions': 'Acciones',
    'character.colors': 'Colores',
    'character.equipment': 'Equipamiento',
    'character.abilities': 'Habilidades',
    'character.description': 'Descripción',
    'character.skin': 'Piel',
    'character.helmet': 'Casco',
    'character.suit': 'Traje',
    'character.primary': 'Primario',
    'character.secondary': 'Secundario',
    'character.idle': 'Reposo',
    'character.walk': 'Caminar',
    'character.shoot': 'Disparar',
    'character.slash': 'Cortar',
    'character.death': 'Muerte',
    'character.weight': 'Peso:',
    'character.budget': 'Presupuesto:',
    'character.weapons': 'Armas',
    'character.items': 'Objetos',
    'character.points': 'puntos',
    'character.moveCost': 'Costo para mover una casilla',
    'character.fireCost': 'Costo para disparar arma',
    'character.meleeCost': 'Costo para ataque cuerpo a cuerpo',
    'character.visionRange': 'Rango de visión',
    'character.actionPoints': 'Puntos de acción',
    'character.baseDamage': 'Daño base',
    'character.shootingAccuracy': 'Precisión de disparo',
    'character.meleeAccuracy': 'Precisión cuerpo a cuerpo',
    'character.armor': 'Armadura',
    'character.cancel': 'Cancelar',
    'character.confirm': 'Crear Personaje',
    'character.rotate': 'Rotar',
    'character.presets': 'Preestablecidos',
    'character.none': 'Ninguno',
    'character.credits': 'créditos',
    'character.namePlaceholder': 'Ingresa el nombre del personaje',
    'character.descriptionPlaceholder': 'Describe tu personaje...',
    'character.abilitiesNote': 'Costos más bajos significan mejores habilidades. ¡Distribuye los puntos sabiamente!',
    'character.pointsLabel': 'puntos',
    
    // Conversation
    'conversation.loading': 'Cargando conversación...',
    'conversation.typeResponse': 'O escribe tu propia respuesta...',
    'conversation.send': 'Enviar',
    'conversation.ended': 'Conversación terminada',
    'conversation.retry': 'Reintentar',
    'conversation.actionRequired': 'Acción requerida',
    'conversation.yourResponse': 'Tu respuesta:',
    'conversation.observing': 'Estás observando',
    'conversation.aiExchange': 'Conversación IA - Intercambio',
    'conversation.previous': 'Anterior',
    'conversation.next': 'Siguiente',
    'conversation.interrupt': 'Interrumpir',
    'conversation.continueListen': 'Seguir escuchando',
    'conversation.narrator': 'Narrador',
    'conversation.storyContinues': 'La historia continúa...',
    
    // Top Bar
    'topbar.campaign': 'Campaña',
    'topbar.map': 'Mapa',
    'topbar.actionPoints': 'Puntos de Acción:',
    'topbar.currentTurn': 'Turno Actual:',
    'topbar.endTurn': 'Finalizar Turno',
    'topbar.loading': 'Cargando...',
    
    // Bottom Bar
    'bottombar.tapToMove': '👆 Toca para mover',
    'bottombar.holdToRotate': '👆 Mantén para rotar',
    'bottombar.pinchToZoom': '🤏 Pellizca para zoom',
    
    // Popup
    'popup.actions': 'Acciones',
    'popup.pin': 'Fijar ventana',
    'popup.unpin': 'Desfijar ventana',
    'popup.close': 'Cerrar ventana',
    
    // Story Journal
    'journal.mainMission': 'Misión Principal',
    'journal.sideMissions': 'Misiones Secundarias',
    'journal.characters': 'Personajes',
    'journal.notes': 'Notas',
    'journal.empty': 'Vacío',
    'journal.noMainMission': 'Sin misión principal activa',
    'journal.noSideMissions': 'Sin misiones secundarias disponibles',
    'journal.noCharacters': 'Sin personajes conocidos',
    'journal.noNotes': 'Sin notas registradas',
    
    // Select Character
    'select.title': 'Selecciona Tu Personaje',
    'select.choose': 'Elegir',
    'select.noOneToTalk': 'No hay nadie más alrededor para hablar',
    
    // Origin Selection
    'origin.title': 'Elige Tu Origen',
    'origin.subtitle': 'Tu pasado define tu camino...',
    'origin.mercenary': 'Mercenario',
    'origin.mercenaryDesc': 'Guerrero curtido en batalla con experiencia en combate',
    'origin.detective': 'Detective',
    'origin.detectiveDesc': 'Investigador agudo con habilidades de observación',
    'origin.explorer': 'Explorador',
    'origin.explorerDesc': 'Alma aventurera con instintos de supervivencia',
    
    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.ok': 'OK',
    'common.cancel': 'Cancelar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.accept': 'Aceptar',
    'common.reject': 'Rechazar',
    'common.save': 'Guardar',
    'common.load': 'Cargar',
    'common.delete': 'Eliminar',
    'common.confirm': 'Confirmar',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.skip': 'Saltar',
    'common.start': 'Comenzar',
    'common.continue': 'Continuar',
    'common.retry': 'Reintentar',
    'common.quit': 'Salir',
    'common.close': 'Cerrar',
    'common.open': 'Abrir',
    'common.select': 'Seleccionar',
    'common.selected': 'Seleccionado',
    'common.available': 'Disponible',
    'common.unavailable': 'No disponible',
    'common.locked': 'Bloqueado',
    'common.unlocked': 'Desbloqueado',
    'common.enabled': 'Activado',
    'common.disabled': 'Desactivado',
    'common.on': 'Encendido',
    'common.off': 'Apagado',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.language': 'Idioma',
    'settings.sound': 'Sonido',
    'settings.music': 'Música',
    'settings.comingSoon': 'Más configuraciones próximamente...',
    'settings.effects': 'Efectos',
    'settings.graphics': 'Gráficos',
    'settings.quality': 'Calidad',
    'settings.low': 'Baja',
    'settings.medium': 'Media',
    'settings.high': 'Alta',
    'settings.ultra': 'Ultra',
    
    // Error Messages
    'error.loadFailed': 'Error al cargar el juego',
    'error.saveFailed': 'Error al guardar el juego',
    'error.connectionLost': 'Conexión perdida',
    'error.invalidAction': 'Acción inválida',
    'error.notEnoughAP': 'Puntos de acción insuficientes',
    'error.targetOutOfRange': 'Objetivo fuera de alcance',
    'error.pathBlocked': 'Camino bloqueado',
    'error.invalidTarget': 'Objetivo inválido',
    'error.characterDead': 'El personaje está muerto',
    'error.gameOver': 'Fin del Juego',
    
    // Inventory
    'inventory.title': 'Inventario',
    'inventory.equipped': 'Armas Equipadas',
    'inventory.primary': 'Primaria',
    'inventory.secondary': 'Secundaria',
    'inventory.weapons': 'Armas',
    'inventory.otherItems': 'Otros Objetos',
    'inventory.empty': 'Tu inventario está vacío',
    'inventory.emptySlot': 'Vacío',
    'inventory.equip': 'Equipar',
    'inventory.weight': 'Peso',
    
    // Actions
    'action.aim': 'Apuntar',
    'action.requiresRangedWeapon': 'Requiere arma a distancia',
    'action.move': 'Mover',
    'action.shoot': 'Disparar',
    'action.reload': 'Recargar',
    'action.melee': 'Cuerpo a cuerpo',
    'action.closeCombat': 'Combate Cercano',
    
    // Select Character
    'select.noCharacters': 'No hay personajes disponibles',
    
    // Multiplayer
    'multiplayer.lobby': 'Sala Multijugador',
    'multiplayer.joinGame': 'Unirse a Partida',
    'multiplayer.createGame': 'Crear Partida',
    'multiplayer.waiting': 'Esperando jugadores...',
    'multiplayer.players': 'Jugadores',
    'multiplayer.enterName': 'Ingresa tu nombre',
    'multiplayer.roomName': 'Nombre de sala',
    'multiplayer.roomFull': 'La sala está llena',
    'multiplayer.roomNotFound': 'Sala no encontrada',
    'multiplayer.connectionFailed': 'Error al conectar con el servidor',
    
    // Misc UI
    'ui.wall': 'Pared',
    'ui.hp': 'PV',
    'ui.lockedDoor': 'Puerta cerrada con llave',
    'ui.openDoor': 'Puerta abierta',
    'ui.closedDoor': 'Puerta cerrada',
    'ui.doorStateLabel': 'Estado',
    'ui.openState': 'Abierta',
    'ui.closedState': 'Cerrada',
    'ui.lockedState': 'Cerrada con llave',
    'ui.door': 'Puerta',
    'ui.exitDoor': 'Salida',
    'ui.mission': 'Misión',
    'ui.damage': 'daño',
    'ui.range': 'alcance',
    'ui.weight': 'kg',
    'ui.cost': '¢',
    
    // Defense Wheel
    'defense.title': '¡Defiéndete del Ataque!',
    'defense.attackerInfo': 'ataca con',
    'defense.defenderInfo': 'defiende con',
    'defense.selectDefense': 'Selecciona tu defensa:',
    'defense.perfectBlock': 'Bloqueo Perfecto',
    'defense.goodDefense': 'Buena Defensa',
    'defense.partialDefense': 'Defensa Parcial',
    'defense.poorDefense': 'Defensa Pobre',
    'defense.noDamage': '0 daño',
    'defense.lowDamage': '33% daño',
    'defense.mediumDamage': '66% daño',
    'defense.highDamage': '100% daño',
    
    // Loading
    'loading.pleaseWait': 'Por favor espera...',
    'loading.connecting': 'Conectando...',
    'loading.preparing': 'Preparando juego...',
  }
};

export type TranslationKey = keyof TranslationKeys;
export type Language = keyof typeof translations;
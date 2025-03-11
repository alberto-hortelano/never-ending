# State cycle

1. Initial state
Get it from localStorage or the server
{
    map: `
###########
###┏━=━┓###
#┏━┛   ┗━┓#
#┃       ┃#
#┃ ┏━ ━┓ ┃#
#┃ ┃   ┃ ┃#
#┃ ┃   ┃ ┃#
#┃ ┃   ┃ ┃#
#┣ ┻━┳━┻ ┫#
#┃   ┃   ┃#
#┃   ┃   ┃#
#┃   ┃   ┃#
#┗━━━┻━━━┛#
###########
`,
    characters: {
        Data: `<Data's description>`,
    },
    story: [
        `This is the begginig of the game. Data and the player are at the stolen spaceship.
Now you will play the role of Data and write it's lines.
Answer with only the json object`,
    ]
}

2. Print map, add characters

3. Send state
Request to StoryEngine


state = {
    ...state,
    talk: {
        target: 'Data',
        content: 'Hi Im data',
    },
}


Example state:

{
    map: '<spaceship>',
    characters: [
        <spaceship crew>
    ],
    story: [
        `This is the begginig of the game. Data and the player are in the stolen spaceship.
Now you will play the role of Data and write it's lines. Answer with only the json object`,
    ]
}

Prompt: You will receive an object with a map, a list of characters and a list of texts narrating the story
You have to answer with a new short text with the next step in the story


// Bot names and profile pictures
const botNames = [
    'alex',
    'john',
    'harry',
    'henry',
    'kishan',
    'StreamMod',
    'ChatGuide',
    'StreamAssist',
    'ViewerGuide',
    'ChatHelper'
];

const profilePics = [
    'X', 'Y', 'Z', 'Y', 'A', 'B', 'Y', 'B', 'Y', 'T'
];

// Different types of messages for variety
const messageTemplates = [
    'Hello everyone! Welcome to the stream! 👋',
    'Amazing stream! Keep it up! 🔥',
    'This is so entertaining! 🎉',
    'Thanks for streaming! 🙏',
    'Great content as always! ⭐',
    'Love the energy here! ✨',
    'This is exactly what I needed today! 💫',
    'You\'re doing great! 👍',
    'Can\'t wait to see what\'s next! 🎯',
    'This stream is fire! 🔥',
    'Such a great community here! 💖',
    'This is awesome! 🌟',
    'Keep up the good work! 💪',
    'Loving the stream! ❤️',
    'This is so much fun! 🎮',
    'You make it look easy! 🏆',
    'Best stream ever! 🎉',
    'This is incredible! 🌈',
    'You\'re killing it! 💯',
    'Can\'t stop watching! 👀'
];

// Reactions and emojis
const reactions = [
    '👍', '❤️', '🔥', '👏', '🎉',
    '💯', '⭐', '🌟', '💫', '✨'
];

// Bot messages
const BOT_MESSAGES = [
    "Welcome to the stream! 👋",
    "Don't forget to follow for more content! 🌟",
    "Having a great time? Let us know in the chat! 💬",
    "Thanks for being here! 🙏",
    "Feel free to ask questions! 🤔",
    "Remember to stay hydrated! 💧",
    "Enjoying the stream? Share it with friends! 🎉",
    "Your support means a lot! ❤️",
    "What's everyone up to? 🎮",
    "Great vibes in the chat! 🎵"
];

// Generate a fake comment with a bot name and message
const generateFakeComment = () => {
    const nameIndex = Math.floor(Math.random() * botNames.length);
    const messageIndex = Math.floor(Math.random() * messageTemplates.length);
    const reactionIndex = Math.floor(Math.random() * reactions.length);
    const profileIndex = Math.floor(Math.random() * profilePics.length);

    return {
        username: botNames[nameIndex],
        message: messageTemplates[messageIndex],
        reaction: reactions[reactionIndex],
        profilePic: profilePics[profileIndex],
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
    };
};

// Pre-generated comments for initial chat history
const fakeComments = Array(10).fill(null).map(() => generateFakeComment());

module.exports = {
    botNames,
    profilePics,
    messageTemplates,
    reactions,
    generateFakeComment,
    fakeComments,
    BOT_MESSAGES
};

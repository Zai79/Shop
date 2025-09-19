const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// إنشاء عميل
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Message, Partials.Channel],
});

// ملف الكلمات
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const wordsFile = path.join(dataDir, 'words.json');
if (!fs.existsSync(wordsFile)) fs.writeFileSync(wordsFile, JSON.stringify([]));

function loadWords() {
    return JSON.parse(fs.readFileSync(wordsFile));
}

function saveWords(words) {
    fs.writeFileSync(wordsFile, JSON.stringify(words, null, 2));
}

function encrypt(text) {
    return Buffer.from(text).toString('base64');
}

// أوامر الرسائل
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // أمر +كلمات
    if (message.content === '+كلمات') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('add_word')
                .setLabel('إضافة كلمة')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('show_words')
                .setLabel('عرض كلمات')
                .setStyle(ButtonStyle.Secondary)
        );

        await message.reply({ content: 'اختر إجراء:', components: [row] });
    }

    // أمر +تشفير
    if (message.content === '+تشفير') {
        await message.delete();

        const embed = new EmbedBuilder()
            .setTitle('🔒 التشفير')
            .setDescription('اختر زر للتشفير أو لعرض الكلمات:')
            .setColor('DarkButNotBlack')
            .setThumbnail(message.guild.iconURL())
            .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('encrypt_sentence')
                .setLabel('تشفير ✏')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('show_words_hidden')
                .setLabel('عرض كلمات 📋')
                .setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// تفاعلات الأزرار والمودالات
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const id = interaction.customId;
        const words = loadWords();

        if (id === 'add_word') {
            const modal = new ModalBuilder()
                .setCustomId('modal_add_word')
                .setTitle('إضافة كلمة')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('word_input')
                            .setLabel('الكلمة')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('enc_input')
                            .setLabel('تشفيرها')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );
            return interaction.showModal(modal);
        }

        if (id === 'show_words' || id === 'show_words_hidden') {
            const list = words.map(w => `**${w.word}** → \`${w.enc}\``).join('\n') || 'لا توجد كلمات محفوظة بعد.';
            const embed = new EmbedBuilder()
                .setTitle('📋 الكلمات المشفرة')
                .setDescription(list)
                .setColor('DarkButNotBlack')
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

            return interaction.reply({ embeds: [embed], ephemeral: id === 'show_words_hidden' });
        }

        if (id === 'encrypt_sentence') {
            const modal = new ModalBuilder()
                .setCustomId('modal_encrypt')
                .setTitle('تشفير جملة أو كلمة')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('input_text')
                            .setLabel('ادخل الجملة أو الكلمة')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        const words = loadWords();

        if (id === 'modal_add_word') {
            const word = interaction.fields.getTextInputValue('word_input');
            const enc = interaction.fields.getTextInputValue('enc_input');

            words.push({ word, enc });
            saveWords(words);

            return interaction.reply({ content: `✅ تمت إضافة الكلمة: **${word}** بتشفير: \`${enc}\``, ephemeral: true });
        }

        if (id === 'modal_encrypt') {
            const input = interaction.fields.getTextInputValue('input_text');
            let replaced = input;
            let found = false;

            for (const w of words) {
                if (replaced.includes(w.word)) {
                    replaced = replaced.replaceAll(w.word, w.enc);
                    found = true;
                }
            }

            const result = found ? replaced : encrypt(input);

            return interaction.reply({
                content: `🔑 **بعد التشفير:**\n\`\`\`${result}\`\`\``,
                ephemeral: true,
            });
        }
    }
});

// تسجيل الدخول
client.login(process.env.TOKEN);

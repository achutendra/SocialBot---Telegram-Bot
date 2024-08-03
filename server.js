import {Telegraf} from "telegraf";
import userModel from "./src/models/User.js";
import eventModel from "./src/models/Event.js";
import connectDB from "./src/config/db.js";
import { message } from "telegraf/filters";
import OpenAI from 'openai';


const bot = new Telegraf(process.env.BOT_TOKEN);

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'], 
  });

try{
    connectDB();
    console.log("Connected to MongoDB");
}catch(err){
    console.log("err", err);
    process.kill(process.pid, 'SIGTERM');
}


bot.start(async(ctx) => {

    const from = ctx.update.message.from;

    console.log("from", from);

    try{
        await userModel.findOneAndUpdate({ tgId:from.id}, {
            $setOnInsert: {
                firstName: from.first_name,
                lastName: from.last_name,
                username: from.username,
                isBot: from.is_bot
            }
        }, { upsert: true, new: true });

        await ctx.reply(`Hi ${from.first_name}, Welcome to SocialBot, What a Beautiful Day`);

    }catch(err){
        console.log("err", err);
        await ctx.reply("Something went wrong, please try again later");
    }

    console.log("ctx", ctx);
    
    console.log("Welcome to SocialBot");
});

bot.command("generate", async(ctx) => {
    const from = ctx.update.message.from;

    const (message_id: waitingMessageId) = await ctx.reply("Please wait, generating posts...");

    const (message_id: loadingSticker) = await ctx.replyWithSticker()
    // get event for the user

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const events  = await eventModel.find({
        tgId: from.id,

        createdAt: {
            $gte: startOfDay,
            $lt: endOfDay
        }
    });

    if(events.length === 0){
        await ctx.deleteMessage(waitingMessageId);
        await ctx.reply("No events found");

        return;
    }

    console.log("events", events);

    // make openai api call

    try{
        const chatCompletion = await OpenAI.chat.completions.create({
            messages: [
                {
                    role: "system",

                    content: ` Act as a senior copywriter, you write highly engaging posts for Linkedin, facebook and twitter using 
                        provided thoughts/events through a day `,
                    
                },

                {
                    role: "user",

                    content: `Write like a human, for humans. Craft three engaging posts tailored for Linkedin, facebook and twitter audiences.
                        Use simple language. Use given time labels just to understand the order of event, dont mention the time in the post. 
                        Each post should creatively highlight the following events. insure that the tone is conversational and impactful. Focus 
                        on enaging the respective platform's audience, encouraging interaction and interest in the event - 
                        $({events.map((event)  => event.text).join(", ")})`,
                    
                    
                },
            ],

            model: process.env.OPENAI_MODEL
        });

        console.log("chatCompletion", chatCompletion);

        // Store token count

        await userModel.findOneAndUpdate(
            {
                tgId:from.id
            },

            {
                $inc: {
                    promptTokens: chatCompletion.usage.prompt_tokens,
                    completionTokens: chatCompletion.usage.completion_tokens,
                }
            }
        );

        await ctx.deleteMessage(waitingMessageId);
        await ctx.reply(chatCompletion.choices[0].message.content);

    }catch(err){
        console.log("err", err);
    }

    

    // send response to user

   
});

bot.on(message('sticker'), (ctx) => {
    console.log('sticker', ctx.update.message.sticker.file_id);
})

bot.on(message('text'), async(ctx) => {

    const from = ctx.update.message.from;
    const message = ctx.update.message.text;

    try{
        await eventModel.create({
            text: message,
            tgId: from.id
        });

        await ctx.reply("Noted, keep texting me your thoughts. To generate posts, just type command: /generate");

    }catch(err){
        console.log("err", err);
        await ctx.reply("Something went wrong, please try again later");
    }
    
});



bot.launch();


// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

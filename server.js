import {Telegraf} from "telegraf";
import userModel from "./src/models/User.js";

const bot = new Telegraf(process.env.BOT_TOKEN);


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


bot.launch();


// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

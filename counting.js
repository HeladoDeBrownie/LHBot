const fs = require('fs');
const path = require('path');
let config = null;
const countingDataPath = path.resolve('./counting.json');
const countingData = require(countingDataPath);
const validCountRegex = /^[0-9]+$/;
let countingChannel = null;

// Function to write game list data to file
function WriteState() {
  fs.writeFile(countingDataPath, JSON.stringify(countingData, null, 2), function(err) {
    if (err) {
      return console.log(err);
    }
  });
}

function BuildBotMessage(author, botMessages)
{
  const messageIndex = Math.floor(Math.random() * botMessages.length);
  let botMessage = botMessages[messageIndex];

  botMessage = botMessage.replace(/\$user/g, author);
  return(botMessage);
}

function FailCounting(message, reason)
{
  //console.log(reason);
  countingData.lastCount = 0;
  countingData.lastMessage = message.id;
  return BuildBotMessage(message.author, config.countingFailMessages);
}

function CheckNextMessage(message)
{
  //console.log(message);
  if(!validCountRegex.test(message.content))
  {
    return FailCounting(message, 'Counting failed because invalid attempt: ' + message + ' expected ' + (countingData.lastCount + 1));
  }

  const number = parseInt(message.content);
  if(countingData.lastCount != null && number != countingData.lastCount + 1)
  {
    return FailCounting(message, 'Counting failed because out of order: ' + message + ' expected ' + (countingData.lastCount + 1));
  }

  countingData.lastCount = number;
  countingData.lastMessage = message.id;
  //console.log(message.content);
  return null;
}

function CheckMessages(messages)
{
  console.log(`Received ${messages.size} messages`);
  let outputMessages = null;

  for(let snowflake of Array.from(messages.keys()).reverse())
  {
    const message = messages.get(snowflake);
    if(!message.author.bot)
    {
      const out = CheckNextMessage(message);
      if(out)
      {
        if(outputMessages)
        {
          outputMessages += '\n';
        }
        else
        {
          outputMessages = "";
        }
        outputMessages += out;
      }
    }
  }
  if(outputMessages)
  {
    if(countingData.lastCount == 0)
    {
      outputMessages += '\n' + BuildBotMessage({author: "dummy"}, config.countingStartMessages);
    }
    countingChannel.send(outputMessages);
  }
  console.log(`Resuming counting from ${countingData.lastCount}`);
  WriteState();
}

function RestoreCountingState(client)
{
  console.log('Counting channel: ' + config.countingChannelId);

  while(countingChannel == null)
  {
    console.log('Trying to get Counting channel');
    countingChannel = client.channels.get(config.countingChannelId);
  }
  
  console.log('Counting channel: ' + countingChannel.name);

  var queryOptions = {};

  if (countingData.lastMessage == null)
  {
    queryOptions.limit = 100;
  }
  else
  {
    queryOptions.after = countingData.lastMessage;
  }

  countingChannel.fetchMessages(queryOptions)
    .then(messages => CheckMessages(messages));
}

function InitConfig(lrConfig)
{
  config = lrConfig;
  if(config.countingFailMessages == null)
  {
    config.countingFailMessages = ["I think $user broke counting!", "That's not right, $user", "Here's $user, ruining it for everyone", "Oh dear, $user. Oh dear.", "It's ok $user, I love you anyway"];
  }
  if(config.countingStartMessages == null)
  {
    config.countingStartMessages = ["Time to start over", "Back to the beginning!", "Gimme a 1", "What do we start with?", "0"];
  }
}

function PublicOnReady(lrConfig, client)
{
  InitConfig(lrConfig);
  RestoreCountingState(client);
}

function PublicHandleMessage(message)
{
  if(message.channel.id === config.countingChannelId && !message.author.bot)
  {
    let output = CheckNextMessage(message);
    if(output)
    {
      if(countingData.lastCount == 0)
      {
        output += '\n' + BuildBotMessage(message, config.countingStartMessages);
      }
      message.channel.send(output);
    }
    WriteState();
    return(true);
  }
  return(false);
}

exports.OnReady = PublicOnReady;
exports.HandleMessage = PublicHandleMessage;

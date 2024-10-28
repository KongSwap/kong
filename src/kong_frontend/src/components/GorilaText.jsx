import React, { useEffect, useState } from 'react';
import kongImage from '../../../assets/kong.png';

const messages = [
    "HODL like a gorilla holds a banana!",
    "Don’t let the bears scare you; gorillas are kings of the jungle!",
    "Going bananas over these crypto gains!",
    "Remember, even gorillas diversify their bananas!",
    "Why swing from tree to tree when you can swing trade?",
    "In the jungle of crypto, always aim to be the King Kong of trading!",
    "Got crypto? Or just monkeying around?",
    "Don’t ape in, do your research!",
    "Even gorillas have a strategy; what’s yours?",
    "King Kong knows: crypto is wild, but rewarding!",
    "Bananas are great, but crypto is sweeter!",
    "Ever seen a gorilla panic sell? Exactly.",
    "Strong hands, like a gorilla’s grip!",
    "Remember, King Kong didn’t become king by following the crowd!",
    "Gorillas don’t need to check prices; they just know they’re on top!",
    "Swing high, swing low, but always swing with a plan!",
    "Keep calm and gorilla on!",
    "Bananas are temporary, blockchain is forever!",
    "Gorilla tip: patience is key in the crypto jungle!",
    "Even King Kong loves a good bull run!",
    "Big bananas come to those who wait!",
    "King Kong’s rule: never sell the jungle for a banana!",
    "Gorilla wisdom: buy low, HODL strong!",
    "Even King Kong keeps an eye on gas fees!",
    "Gorillas don’t chase; they let opportunities come to them!",
    "King Kong’s favorite altcoin? Whatever makes him the most bananas!",
    "Hold on tight; crypto is a wild jungle ride!",
    "Gorillas know: it’s not timing the market, but time in the market!",
    "Crypto market swings? Just another day in the jungle!",
    "King Kong says: keep your crypto safe like a banana stash!",
    "Even gorillas love decentralized bananas!",
    "Ape in style, trade with a smile!",
    "In the crypto jungle, King Kong rules the trees and the trades!",
    "Gorilla strength isn’t just physical; it’s mental for HODLing!",
    "King Kong’s crypto motto: swing high, never shy!",
    "King Kong’s secret to success: patience and big roars!",
    "From bananas to Bitcoin, it’s all about the stash!",
    "Gorillas don’t sweat the dips; they swing through them!",
    "Every gorilla knows: it’s not the size of the dip, but the size of the bounce!",
    "King Kong doesn’t just follow trends; he sets them!",
];

const GorilaText = () => {
    const [currentMessage, setCurrentMessage] = useState(messages[0]);

    useEffect(() => {
        const intervalId = setInterval(() => {
          const newMessage = messages[Math.floor(Math.random() * messages.length)];
          setCurrentMessage(newMessage);
          setTimeout(() => setCurrentMessage(""), 10000);
        }, 55000);
    
        return () => clearInterval(intervalId);
      }, []);

    return (
        <div className="swap-page-kong-image-container">
        <img src={kongImage} className="swap-page-kong-image" alt="" />
        {currentMessage.length > 0 && (
          <span className="bubble bubble--swappage-kong bubble--text1">
            <span className="bubble__top"></span>
            <span className="bubble__mid"></span>
            <span className="bubble__bottom"></span>
            <span className="bubble__content">{currentMessage}</span>
          </span>
        )}
      </div>
    );
};

export default GorilaText;

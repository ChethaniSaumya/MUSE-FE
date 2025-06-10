import React, { Component, useEffect } from 'react';
import '../App.css';
import "aos/dist/aos.css";
import Aos from 'aos';
import nft from '../assets/cat.png';

const Stry = () => {
    useEffect(() => {
        Aos.init({ duration: 4000 });
    }, [])
}

class About extends Component {

    render() {
        return (

            <div class="boxWrap2Story">

                <div class="about">
 
                <img src={nft} />

                    <div class="storyCon">
                        <div class="conT"><span className='hl2-1'>BASEMEW</span><span class="hl2"> INTRODUCTION</span></div>
                        
                        <p>Welcome to the exhilarating world of Basemew inspired by “BATMAN”, a pioneering meme coin poised to reshape the crypto landscape! Emerging from the enigmatic shadows of Crypto City on the Base blockchain, Basemew blends the allure of meme culture with robust crypto economics to offer a uniquely engaging experience.</p>
                        <p>Basemew isn't just another meme coin; it's a movement. At its core, Basemew is designed to captivate a community of enthusiasts who are passionate about the potential and whimsy of cryptocurrency. With its charming and mystic aesthetic, inspired by tales as timeless as Gotham's own guardian, Basemew invites you to join an adventure filled with promise and potential.</p>
                        <p>As the crypto markets fluctuate, Basemew stands as a beacon of humor and hope, encouraging not just investment but a vibrant participation in its community. Each transaction within the Basemew ecosystem is crafted to contribute to its liquidity, ensuring stability and rewarding holders with a decentralized financial empowerment that grows over time.</p>
                        <p>Join us in shaping the destiny of Basemew. Dive into a community where every member holds the key to not only fostering growth but also steering the narrative of this budding meme hero. It's not just about investment; it's about being part of a journey to the moon, where every participant gets to reap the dreamlike benefits of early adoption. Embrace the charm of Basemew and let's soar together in the vast crypto universe!</p>
                        
                    </div>

                </div>

            </div>
        )
    }
}

export default About;


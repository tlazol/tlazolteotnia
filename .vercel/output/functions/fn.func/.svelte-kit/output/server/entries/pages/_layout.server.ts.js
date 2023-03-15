import { e as error } from "../../chunks/index.js";
const uri = "https://0rga.org";
const siteName = "Tlazolteotnia";
const img = "/img/gallery/44.jpg";
const getMetaData = (pathname) => {
  if (pathname === "/") {
    return {
      "ja-JP": {
        title: `${siteName}`,
        description: `${siteName}は、Daisuke Kobayashiのweb上での家です。描いた絵や、作ったゲームなどが、置いてあります。ところで、最近は、ピーナッツチョコレートにハマっています。抹茶と共に、ボリボリ食べるのが最高です。では、好きなように楽しんで！`,
        img: `${uri}${img}`,
        url: `${uri}`
      },
      "en-US": {
        title: `${siteName}`,
        description: `${siteName} is Daisyuke Kobayashi's home on the web. There are pictures I have drawn and games I have made. By the way, I've been addicted to peanut chocolate lately. The best way to eat it is with matcha tea. Well, enjoy as much as you like!`,
        img: `${uri}${img}`,
        url: `${uri}`
      }
    };
  }
  if (pathname === "/gallery") {
    return {
      "ja-JP": {
        title: `Gallery - ${siteName}`,
        description: `ここはギャラリーです。昔に描いた絵から、最近の絵まで、色々と置いています。僕は青と赤の組み合わせが好きです。`,
        img: `${uri}${img}`,
        url: `${uri}/gallery`
      },
      "en-US": {
        title: `Gallery - ${siteName}`,
        description: `This is the gallery. There are some old paintings and some recent ones. I like the combination of blue and red.`,
        img: `${uri}${img}`,
        url: `${uri}/gallery`
      }
    };
  }
  if (pathname.startsWith("/blog")) {
    return {
      "ja-JP": {
        title: `Blog - ${siteName}`,
        description: `ここはブログです。たまに更新されます。`,
        img: `${uri}${img}`,
        url: `${uri}/blog`
      },
      "en-US": {
        title: `Blog - ${siteName}`,
        description: `This is a blog. It will be updated occasionally.`,
        img: `${uri}${img}`,
        url: `${uri}/blog`
      }
    };
  }
  if (pathname === "/skill") {
    return {
      "ja-JP": {
        title: `Games - ${siteName}`,
        description: `ここはゲーム置き場です。たくさんのゲームを作ってきましたが、代表的なものだけ置くことにしました。だって、ゴミ屋敷みたいに見えるより、キレイな部屋のほうが、みんな好きだから。`,
        img: `${uri}/static/parts-img/skills.jpg`,
        url: `${uri}/skill`
      },
      "en-US": {
        title: `Games - ${siteName}`,
        description: `Here is the game list. I've made a lot of games, but I've decided to put only the representative ones. Because people like to have a clean room rather than looking like a garbage house.`,
        img: `${uri}/static/parts-img/skills-en.jpg`,
        url: `${uri}/en/skill`
      }
    };
  }
  if (pathname === "/skill/dwarf") {
    return {
      "ja-JP": {
        title: `【公式】ドワーフのトンネル`,
        description: `放置系採掘系RPGの「ドワーフのトンネル」がリッチになってリニューアル！これまでは存在しなかったキャラクターや宝石が追加されました！宝石を掘って掘って掘りまくり、王国を発展させましょう。`,
        img: `${uri}/img/material/dwarfMine.jpg`,
        url: `${uri}/skill/dwarf`
      },
      "en-US": {
        title: `Dwarf mine`,
        description: `Dwarf Mine RPG game has been updated with a rich experience!!! You can visit a new kingdom with new characters and episodes.  Mine and Mine and Mine your jewels to develop your new kingdom!`,
        img: `${uri}/img/material/dwarfMine.jpg`,
        url: `${uri}/en/skill/dwarf`
      }
    };
  }
  if (pathname === "/skill/brave") {
    return {
      "ja-JP": {
        title: `【公式】勇者と逆さまの塔`,
        description: `勇者と逆さまの塔は、Google アシスタントで遊べる放置系ハックアンドスラッシュ系ゲームです。地下深くに伸びる逆さまの塔に挑み、武器を手に入れ、強化し、どんどん下まで降りていこう。様々な武器と、8種類の職業があり、攻略の仕方はあなた次第！自分だけの最強の冒険者を作り上げろ！`,
        img: `${uri}/img/material/heroOfDungeon.jpg`,
        url: `${uri}/skill/brave`
      },
      "en-US": {
        title: `Hero of Dungeon`,
        description: `Hero of Dungeon is a hack-and-slash RPG, played with the Google Assistant. Take on the Reverse Tower that stretches deep underground, get weapons, strengthen them, and keep going down!`,
        img: `${uri}/img/material/heroOfDungeon.jpg`,
        url: `${uri}/en/skill/brave`
      }
    };
  }
  if (pathname === "/skill/robo") {
    return {
      "ja-JP": {
        title: `【公式】バトルマシン`,
        description: `バトルマシンは、Google アシスタントで遊べる放置系ハックアンドスラッシュ系ゲームです。エクスエンジニアとなり、自分だけのエクスで、古代遺跡の謎を解き明かそう！エクスを様々な強化パーツでカスタマイズして、自分だけの最強の機体を作り上げろ！`,
        img: `${uri}/img/material/battleMachine.jpg`,
        url: `${uri}/skill/robo`
      },
      "en-US": {
        title: `Battle Machine`,
        description: `Under development.`,
        img: `${uri}/img/material/battleMachine.jpg`,
        url: `${uri}/en//skill/robo`
      }
    };
  }
  if (pathname === "/skill/demon") {
    return {
      "ja-JP": {
        title: `【公式】デモンズダンジョン`,
        description: `デモンズダンジョンは、Google アシスタントで遊べる放置系ハックアンドスラッシュ系ゲームです。魔王となり、80匹の個性的な魔物達から、3匹を選んで、自分だけのパーティーを組み、あらゆる魔物が住むという、デモンズダンジョンの攻略や、他の魔王との対戦を行い、魔界の覇者となろう！`,
        img: `${uri}/img/material/demonsDungeon.jpg`,
        url: `${uri}/skill/demon`
      },
      "en-US": {
        title: `Demon's Dungeon`,
        description: `Under development.`,
        img: `${uri}/img/material/demonsDungeon.jpg`,
        url: `${uri}/en//skill/demon`
      }
    };
  }
};
const load = async function load2({ locals, url }) {
  const metaData = getMetaData(url.pathname);
  const meta = metaData ? metaData[locals.lang] : null;
  try {
    return {
      lang: locals.lang,
      meta
    };
  } catch (e) {
    throw error(404, "Not found");
  }
};
export {
  load
};

---
title: "vue.jsでlightsoutを作って遊ぶ"
date: "2018-01-30"
description: "Vue.js で Lights Out を実装しながら、コンポーネント設計とゲームロジックを試した記録。"
tags: ["JavaScript", "game", "Vue.js", "lightsout"]
draft: false
---
# あらすじ
久しぶりにlightsoutで遊びたくなったけど、手元にない。よし作ろう！
※ vue@2.1.10で作っています。作った当時は最新でした(´・ω・｀)

# lightsoutって？
ボタンを押したら自身と上下左右のボタンの光が反転し、全部消せばクリアという単純ながらも奥深いゲームです。
[wiki:ライツアウト](https://ja.wikipedia.org/wiki/%E3%83%A9%E3%82%A4%E3%83%84%E3%82%A2%E3%82%A6%E3%83%88)

# 完成品
[LIGHTS OUT - JSFiddle](https://jsfiddle.net/covayashi/8gbrwjjg/)

## htmlのソースコード

```html+erb:lightsout.html
<!DOCTYPE HTML>
<html>
    <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css?family=Rajdhani" rel="stylesheet">
    </head>
    <body>
        <h1>lights out</h1>
        <div id="js-vue">
            <lightout></lightout>
        </div>
        <script type="text/javascript" src="https://unpkg.com/vue@2.1.10/dist/vue.js"></script>
    </body>
</html>
```

`id="js-vue"`を持つDOMの中にコンポーネントタグの`<lightout>`があるだけのシンプルな作りです。
Google Fontsはドレスコード。

## vue.jsのソースコード

```javascript+erb:lightsout.js
var vue = new Vue({
    el: '#js-vue'
});
```

とりあえずVuenewして...
lightsoutの■はbool管理ができれば制御できそうですので、

```
■ ■ ■ ■ ■
■ ■ ■ ■ ■
■ ■ ■ ■ ■　←　これ
■ ■ ■ ■ ■
■ ■ ■ ■ ■
```

boxesという配列で再現します。

```javascript+erb:lightsout.js
var temp
= '<div>'
+ '    <div>'
+ '      <div v-for="(val, index) in boxes"></div>'
+ '    </div>'
+ '</div>';

Vue.component('lightout', {
    template: temp,
    data: function(){
        return {
            boxes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        }
    }
});
```

これで0を持つ■が25個できました。
次にマウスオーバーしたら選択している■と上下左右の■が分かるようにしましょう。
選択している■のboxesのindexを取得して制御します。

```javascript+erb:lightsout.js
var temp
= '<div>'
+ '    <div>'
+ '      <div v-for="(val, index) in boxes" @mouseover="search(index)" @mouseout="out()"></div>'
+ '    </div>'
+ '</div>';

Vue.component('lightout', {
    template: temp,
    data: function(){
        return {
            targetKey: [],
            boxes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        }
    },
    methods: {
        out: function(){
            this.targetKey = [];
        },
        search: function(index){
            this.targetKey.push(index); //自身
            if(index > 4){
                this.targetKey.push(index - 5); //上
            }
            if(index < 20){
                this.targetKey.push(index + 5); //下
            }
            if(index % 5 != 4){
                this.targetKey.push(index + 1); //右
            }
            if(index % 5 != 0){
                this.targetKey.push(index - 1); //左
            }
        }
    }
});
```

mouseoverでsearch()を、mouseoutでout()を実行出来るようにテンプレートにv-on(@)を追加します。
targetKeyという空配列を定義して、選択している■のindexが入るようにします。
そしてmouseoutでtargetKeyをリセットしてあげましょう。
これで、選択している■と上下左右の■のindexがmouseoverでtargetKeyに代入されるようになりました。
選択している■が視覚的にわかるとよいので、

```javascript+erb:lightsout.js
var temp
= '<div>'
+ '    <div>'
+ '      <div v-for="(val, index) in boxes" :class="[targetKey.indexOf(index) > -1 ? \'target\' : \'\']" @mouseover="search(index)" @mouseout="out()"></div>'
+ '    </div>'
+ '</div>';
```

テンプレートにv-bind（:）でclassを定義してあげます。
targetKeyに自身のindexが存在すればtargetというclassを付与するようにしましょう。

次は■をぽちっとした時のイベントを定義してあげましょう。

```javascript+erb:lightsout.js
var temp
= '<div>'
+ '    <div>'
+ '      <div v-for="(val, index) in boxes" @click="pochi()" :class="[targetKey.indexOf(index) > -1 ? \'target\' : \'\']" @mouseover="search(index)" @mouseout="out()"></div>'
+ '    </div>'
+ '</div>';
```

■をclickしたらpochi()が実行されるようになりました。

```javascript+erb:lightsout.js
Vue.component('lightout', {
    methods: {
        pochi: function(){
            this.targetKey.forEach(function(index){
                this.toggle(index);
            }, this);
        },
        toggle: function(index){
            if(this.boxes[index] === 0){
                Vue.set(this.boxes, index, 1);
            }else{
                Vue.set(this.boxes, index, 0);
            }
        }
    }
});
```

pochi()は、targetKeyに入っているindex達をtoggle()に渡します。
toggle()はboxes[index]のvalueを見て0と1を反転させます。
本当は `Vue.set(this.boxes, index, !this.boxes[index]);` で反転させたかったけど、0を!で反転させると1じゃなくてtrueになるので、めんど…やめました。

■のデザインも中身が0か1の時で変わるようにしましょう。

```javascript+erb:lightsout.js
var temp
= '<div>'
+ '    <div>'
+ '      <div v-for="(val, index) in boxes" @click="pochi()" :class="[val == 1 ? \'on\' : \'off\', targetKey.indexOf(index) > -1 ? \'target\' : \'\']" @mouseover="search(index)" @mouseout="out()"></div>'
+ '    </div>'
+ '</div>';
```

■自身のvalueが0か1かでonかoffというclassが付与されるようになりました。

これでポチポチ出来るようになりましたので、あとはゲームとして成立させてあげましょう。
クリア判定にはcomputedを使用しましょう。

```javascript+erb:lightsout.js
Vue.component('lightout', {
    computed: {
        goal: function(){
            if(this.boxes.indexOf(1) < 0){
                return true;
            }else{
                return false;
            }
        }
    }
});
```

boxesの中に1がひとつもなくなればgoalがtrueになるようにしました。
全部の■の中身が0になればクリアというわけです。

さて、このゲーム、適当にboxesの中に0と1を散りばめただけでは、クリア不可のデータ状態にもなってしまいます。それでは面白くありません。
ではどうするか。
一番な簡単な方法として、ゲーム開始時は全部0にしておき開始した瞬間に自動的にランダムでポチポチさせればよいのです。元が0から始まっているのでクリア不可なデータ状態は生まれません。
それにはcreatedというvue.jsのライフサイクルを利用したメソッドを使用します。
コンポーネントが作られた時に発火するライフサイクルフックです。

```javascript+erb:lightsout.js
Vue.component('lightout', {
    methods: {
        rand: function(min, max){
            var num = Math.floor(Math.random() * (max + 1 - min)) + min;
            return num;
        }
    },
    created: function(){
        var imax = this.rand(10, 15);
        for(var i = 0; i < imax; i++){
            var r = this.rand(0, 24);
            this.search(r);
            this.pochi();
            this.out();
        }
    }
});
```

rand()というminとmaxを渡すとその間の整数をランダムで返す関数を作りましょう。
そしてcreated()には人が実際に遊ぶ際の動作を行わせます。
これでランダムの回数分、ランダムな■をポチっとしてくれる動きが出来ました。

clickした際の挙動、開始の挙動、クリアの挙動ができましたが、このままだと開始した瞬間にクリアになってしまいますので、フラグを一つ立てましょう。

```javascript+erb:lightsout.js
Vue.component('lightout', {
    template: temp,
    data: function(){
        return {
            setFlg: false,
            targetKey: [],
            boxes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        }
    }
});
```

setFlgなるものをfalseで定義しました。
これをクリア判定と開始の挙動に追加していきます。

```javascript+erb:lightsout.js
Vue.component('lightout', {
    computed: {
        goal: function(){
            if(this.setFlg){
                if(this.boxes.indexOf(1) < 0){
                    return true;
                }else{
                    return false;
                }
            }else{
                return false;
            }
        }
    },
    created: function(){
        var imax = this.rand(10, 15);
        for(var i = 0; i < imax; i++){
            var r = this.rand(0, 24);
            this.search(r);
            this.pochi();
            this.out();
        }
        this.setFlg = true;
    }
});
```

これで、開始した瞬間にクリアになる事はなくなりました。

あとはクリア後の文言など細かい所を調整したのが
[LIGHTS OUT - JSFiddle](https://jsfiddle.net/covayashi/8gbrwjjg/)
これになります。

長くなりましたが、遊んだり作ったりして頂けたら嬉しいです。

# おわりに
ゲームってやるのも楽しいですが、作るのも楽しい！

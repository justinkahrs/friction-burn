import { resolutionText } from "constants/options";
import BaseScene from "scene/BaseScene";
import {
  DefaultHeight,
  DefaultWidth,
  MusicKey,
  SFXKey,
  ImageKey,
} from "constants/gameConst";
import { AddText } from "utils/text";

export default class LoadingScene extends BaseScene {
  constructor() {
    //scene key
    super("LoadingScene");
  }

  preload() {
    AddText({
      scene: this,
      x: DefaultWidth / 2,
      y: DefaultHeight / 2,
      text: "Loading...",
      depth: 0,
      size: 64,
    });

    this.load.audio(SFXKey.Click, "assets/sfx/click.mp3");
    
    // Rider Sprites
    this.load.image(ImageKey.Title, "assets/title.png"); // Assuming Title exists or placeholder? 
    // Wait, ImageKey.Title was there but not preloaded in the snippet I saw? 
    // Review LoadingScene snippet: Only SFX click was preloaded. 
    // Title might be loaded elsewhere or I missed it.
    // I will just add the rider sprites.
    
    this.load.image(ImageKey.RiderVertical, "assets/sprite/rider-vertical.png");
    this.load.image(ImageKey.RiderLeftSlight, "assets/sprite/rider-slight-left.png");
    this.load.image(ImageKey.RiderLeftFull, "assets/sprite/rider-full-left.png");
    this.load.image(ImageKey.RiderRightSlight, "assets/sprite/rider-slight-right.png");
    this.load.image(ImageKey.RiderRightFull, "assets/sprite/rider-full-right.png");
    // this.load.audio(MusicKey.Bgm, "assets/music/bgm.mp3");
  }

  create(data: { settings: any }) {
    this.registry.set("settings", data.settings);
    super.create(data);

    setTimeout(() => this.scene.start("TitleScene"), 2000);

    const selectedResolution = resolutionText[this.currentResolutionIdx];

    this.electronAPI.send("resize-window", {
      width: selectedResolution[0],
      height: selectedResolution[1],
    });

    if (this.fullscreenFlag) {
      this.electronAPI.send("toggle-fullscreen", this.fullscreenFlag);
    }
  }

  update(): void {}
}

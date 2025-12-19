import { Scene } from 'phaser';
import { ImageKey } from '../constants/gameConst';

import { RoadRenderer } from '../classes/RoadRenderer';
import { Track } from '../classes/Track';
import { Player } from '../classes/Player';
import { HUD } from '../classes/HUD';

export class GameScene extends Scene {
  private roadRenderer!: RoadRenderer;
  private track!: Track;
  private player!: Player;
  private hud!: HUD;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private playerSprite!: Phaser.GameObjects.Sprite;
  private hasPowerup: boolean = false;
  private steerDuration: number = 0; // ms

  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x87CEEB); 
    
    this.roadRenderer = new RoadRenderer(this);
    this.track = new Track();
    this.player = new Player();
    this.hud = new HUD(this);
    
    // Rider Sprite
    this.playerSprite = this.add.sprite(
        this.scale.width / 2, 
        this.scale.height - 350, 
        ImageKey.RiderVertical
    ).setDepth(100);
    // Scale down? Try 0.5 initially as 417KB image is likely large
    this.playerSprite.setScale(0.5);

    if (this.input.keyboard) {
        this.cursorKeys = this.input.keyboard.createCursorKeys();
    }
  }

  update(time: number, delta: number) {
    if (!this.cursorKeys) return;
    
    const playerSegment = this.track.getSegment(this.player.z);

    this.player.update(delta, {
      up: this.cursorKeys.up.isDown,
      down: this.cursorKeys.down.isDown,
      left: this.cursorKeys.left.isDown,
      right: this.cursorKeys.right.isDown
    }, playerSegment.curve);
    
    // Steering Sprite Logic
    if (this.cursorKeys.left.isDown) {
        if (this.steerDuration < 1000) {
            this.steerDuration += delta;
            this.playerSprite.setTexture(ImageKey.RiderLeftSlight);
        } else {
            this.playerSprite.setTexture(ImageKey.RiderLeftFull);
        }
    } else if (this.cursorKeys.right.isDown) {
        if (this.steerDuration < 1000) {
            this.steerDuration += delta;
            this.playerSprite.setTexture(ImageKey.RiderRightSlight);
        } else {
            this.playerSprite.setTexture(ImageKey.RiderRightFull);
        }
    } else {
        // Reset
        this.steerDuration = 0;
        this.playerSprite.setTexture(ImageKey.RiderVertical);
    }
    
    // Simple bounce while moving
    if (this.player.speed > 0) {
        this.playerSprite.y = (this.scale.height - 350) + Math.sin(time * 0.05) * 2;
    }
    
    // Update Dynamic Sprites
    // Optimization: Only update sprites near player? Or iterate all?
    // For now, iterate all segments (inefficient but safe).
    // Or better: Track maintains a list of dynamic entities?
    // Let's iterate track segments.
    // Caution: Modifying sprite Z means moving it between segments.
    
    // Loop backwards to allow moving? Or just loop.
    // NOTE: This is slow if track is huge. But we have ~40 sections * ~50 segments = 2000 segments.
    // 2000 iterations is fine.
    
    const roadLength = this.track.totalLength;
    
    this.track.segments.forEach(seg => {
        if (!seg.sprites) return;
        
        for (let i = seg.sprites.length - 1; i >= 0; i--) {
            const sprite = seg.sprites[i];
            const oldZ = sprite.z;
            const dist = sprite.speed * (delta / 1000); // speed is units/sec
            
            sprite.z += dist;
            // Handle wrapping? Or clamping?
            if (sprite.z < 0) sprite.z += roadLength;
            if (sprite.z >= roadLength) sprite.z -= roadLength;
            
            // If segment changed, move sprite
            // We use sprite.z to determine new segment
            const newIndex = Math.floor(sprite.z / this.track.segmentLength) % this.track.segments.length;
            
            if (newIndex !== seg.index) {
                // Move
                seg.sprites.splice(i, 1); // remove from here
                this.track.segments[newIndex].sprites.push(sprite);
            }
        }
    });

    // Render Front
    this.roadRenderer.render(
      this.player.z,
      this.player.x * this.track.roadWidth, 
      this.player.y + playerSegment.p1.y,
      this.track.segments, 
      300, 
      this.track.roadWidth,
      this.track.segmentLength
    );
    
    // Render Mirrors
    this.hud.mirrorGraphics.clear();
    
    // Left
    this.roadRenderer.renderRear(
        this.player.z,
        this.player.x * this.track.roadWidth,
        this.player.y + playerSegment.p1.y,
        this.track.segments,
        100,
        this.track.roadWidth,
        this.track.segmentLength,
        this.hud.leftMirror,
        this.hud.mirrorGraphics
    );
    
    // Right
    this.roadRenderer.renderRear(
        this.player.z,
        this.player.x * this.track.roadWidth,
        this.player.y + playerSegment.p1.y,
        this.track.segments,
        100,
        this.track.roadWidth,
        this.track.segmentLength,
        this.hud.rightMirror,
        this.hud.mirrorGraphics
    );
    
    // Collision Detection for Powerups
    // Simple distance check against nearby sprites (current segment +/- 1)
    
    // We can reuse the loop or do a specific check.
    // Let's do a specific check against the player's current segment sprites
    const checkSegments = [
        this.track.getSegment(this.player.z - this.track.segmentLength), // Prev segment
        this.track.getSegment(this.player.z),
        this.track.getSegment(this.player.z + this.track.segmentLength) // Next segment
    ];
    
    checkSegments.forEach(seg => {
        if (!seg.sprites) return;
        seg.sprites.forEach((s, idx) => {
             // Collision Box? 
             // Player is at x (road normalized), z
             // Sprite is at s.x (road normalized), s.z (abs? no, relative to segment start usually? 
             // Wait, track.addSprite puts z as absolute.
             // HUD/Renderer uses absolute Z. 
             // Sprite.z seems to be absolute based on GameScene update loop logic (sprite.z > roadLength etc).
             
             // Check overlap
             const dz = s.z - this.player.z;
             // Wrap dz if track loops? Simple check: if close.
             // Assume linear close for now.
             
             // Dynamic threshold to prevent tunneling at high speeds
             const distMoved = this.player.speed * (delta / 1000);
             const zThreshold = Math.max(100, distMoved);

             if (Math.abs(dz) < zThreshold) { // Close Z
                 // Check X
                 // Player width ~ 40px? Road width = 2000. 40/2000 = 0.02
                 // Sprite width ~ 400? 400/2000 = 0.2
                 // So normalized width is approx 0.2
                 const dx = Math.abs(this.player.x - s.x);
                 if (dx < 0.2) { // Hit (Widened from 0.15)
                     if (s.type === 'boost_powerup') {
                         // Collect
                         this.hasPowerup = true;
                         // Remove sprite
                         seg.sprites.splice(idx, 1);
                         // Play sound?
                     } else if (s.type === 'red_square') {
                         // Obstacle hit logic (slow down)
                         // For now, minimal penalty from original code is just passing through?
                         // Original code had no collision.
                         // Let's add slight speed penalty for obstacle collision
                         this.player.speed = Math.max(0, this.player.speed - 2000 * (delta/1000));
                     }
                 }
             }
        });
    });

    // Handle Input for Boost
    if (this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).isDown) {
        if (this.hasPowerup && this.player.boostTimer <= 0) {
            this.player.activateBoost();
            this.hasPowerup = false;
        }
    }

    // Update HUD
    const isBoosting = this.player.boostTimer > 0;
    this.hud.update(this.player.speed, this.player.maxSpeed, this.player.z, this.hasPowerup, isBoosting);
  }
}

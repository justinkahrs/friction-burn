import Phaser from 'phaser';

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface Sprite {
  x: number;      // -1 to 1
  y: number;      // Vertical offset from road surface (usually 0)
  z: number;      // Absolute Z (redundant segment lookup but good for caching)
  type: string;
  speed: number;  // Relative speed
  width: number;
  height: number;
  scale: number;  // Visual scale
}

export interface Segment {
  index: number;
  p1: Point;
  p2: Point;
  curve: number;
  sprites: Sprite[]; // Added sprites array
  color: {
    road: number;
    grass: number;
    rumble: number;
  };
}

export class RoadRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;
  private cameraDepth: number;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.width = scene.scale.width;
    this.height = scene.scale.height;
    this.cameraDepth = 0.84; 
  }

  public render(
    cameraZ: number,
    cameraX: number, 
    cameraY: number,
    segments: Segment[],
    drawDistance: number,
    roadWidth: number,
    segmentLength: number
  ) {
    this.graphics.clear();
    
    // Check if we need to clear sprites from previous frame if we were drawing them differently/
    // Since we use the same graphics object for road, it's cleared.
    
    const startPos = Math.floor(cameraZ / segmentLength);
    
    let dx = 0;
    let x = 0; 
    let maxY = this.height;
    
    // Collection of sprites to draw later
    const visibleSprites: any[] = [];

    for (let n = startPos; n < startPos + drawDistance; n++) {
      const segment = segments[n % segments.length];
      const segmentBaseZ = n * segmentLength;
      
      const p1_z = segmentBaseZ - cameraZ;
      const p2_z = (segmentBaseZ + segmentLength) - cameraZ;
      
      if (p1_z <= this.cameraDepth) continue;

      const p1_x = -cameraX + x;
      const p1_y = segment.p1.y - cameraY;
      
      dx += segment.curve;
      x += dx;
      
      const p2_x = -cameraX + x;
      const p2_y = segment.p2.y - cameraY; 

      const projectedP1 = this.project({x: p1_x, y: p1_y, z: p1_z}, this.width, this.height, roadWidth);
      const projectedP2 = this.project({x: p2_x, y: p2_y, z: p2_z}, this.width, this.height, roadWidth);
      
      // Collect sprites for later rendering
      if (segment.sprites) {
          for (const s of segment.sprites) {
              const spriteX = p1_x + (s.x * roadWidth);
              const spriteY = p1_y + s.y;
              const spriteZ = p1_z;
              
              const proj = this.project({x: spriteX, y: spriteY, z: spriteZ}, this.width, this.height, roadWidth);
              
              visibleSprites.push({
                  sprite: s,
                  x: proj.x,
                  y: proj.y,
                  w: proj.w,
                  scale: proj.w / roadWidth,
                  clipY: maxY // Clip against the current horizon to handle hill occlusion
              });
          }
      }

      // Check Road Occlusion
      if (projectedP1.y <= projectedP2.y || projectedP2.y >= maxY) continue;

      maxY = projectedP2.y;

      this.renderSegment(
        this.graphics, 
        this.width, 
        segment.color, 
        projectedP1.x, projectedP1.y, projectedP1.w,
        projectedP2.x, projectedP2.y, projectedP2.w
      );
    }
    
    // Draw Sprites (Back to Front)
    for (let i = visibleSprites.length - 1; i >= 0; i--) {
        const s = visibleSprites[i];
        
        // Skip hidden sprites (occluded by hill)
        if (s.y < s.clipY) {
            continue; 
        }
        
        const spriteWidth = s.sprite.width * s.scale;
        const spriteHeight = s.sprite.height * s.scale;
        
        // Centered X
        const destX = s.x - (spriteWidth / 2);
        const destY = s.y - spriteHeight; 
        
        if (s.sprite.type === 'boost_powerup') {
            this.graphics.fillStyle(0xFFFF00); // Yellow for Powerup
        } else if (s.sprite.speed !== 0) {
            this.graphics.fillStyle(0x0000FF); // Blue for moving
        } else {
            this.graphics.fillStyle(0xFF0000); // Red for static
        }
        this.graphics.fillRect(destX, destY, spriteWidth, spriteHeight);
    }
  }

  public renderRear(
    cameraZ: number,
    cameraX: number, 
    cameraY: number,
    segments: Segment[],
    drawDistance: number,
    roadWidth: number,
    segmentLength: number,
    viewport: Phaser.Geom.Rectangle,
    targetGraphics: Phaser.GameObjects.Graphics 
  ) {
    targetGraphics.fillStyle(0x87CEEB); 
    targetGraphics.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    
    const startPos = Math.floor(cameraZ / segmentLength);
    
    let dx = 0;
    let x = 0;
    let maxY = viewport.bottom; 
    
    // Rear view is also Front-to-Back
    // maxY starts at Bottom and moves Up.
    
    const visibleSpritesRear: any[] = [];
    
    for (let n = startPos - 1; n > startPos - drawDistance; n--) {
        const index = ((n % segments.length) + segments.length) % segments.length;
        const segment = segments[index];
        
        const segmentBaseZ = n * segmentLength;
        const p2_z_rel = cameraZ - ((n+1) * segmentLength);
        const p1_z_rel = cameraZ - (n * segmentLength);

        if (p2_z_rel <= this.cameraDepth) continue;
        
        const p2_x_accum = x;
        dx += segment.curve; 
        x += dx; 
        const p1_x_accum = x;
        
        const p1_x = -cameraX + p1_x_accum; 
        const p2_x = -cameraX + p2_x_accum; 
        
        const p1_y = segment.p1.y - cameraY;
        const p2_y = segment.p2.y - cameraY;

        const projP1 = this.projectRear({x: -p1_x, y: p1_y, z: p1_z_rel}, viewport, roadWidth);
        const projP2 = this.projectRear({x: -p2_x, y: p2_y, z: p2_z_rel}, viewport, roadWidth);
        
        // Collect Sprites (Rear)
        if (segment.sprites) {
            for (const s of segment.sprites) {
                 const worldX = -cameraX + p2_x_accum + (s.x * roadWidth);
                 const worldY = p2_y; 
                 const worldZ = p2_z_rel;
                 
                 const proj = this.projectRear({x: -worldX, y: worldY, z: worldZ}, viewport, roadWidth);
                 
                 visibleSpritesRear.push({
                     sprite: s,
                     x: proj.x,
                     y: proj.y,
                     w: proj.w,
                     scale: proj.w / roadWidth,
                     clipY: maxY
                 });
            }
        }

        if (projP1.y >= projP2.y || projP2.y >= maxY) continue;
        if (projP1.y < viewport.y && projP2.y < viewport.y) continue;

        maxY = projP2.y;
        
        this.renderSegment(
            targetGraphics, 
            viewport.width, 
            segment.color,
            projP1.x, projP1.y, projP1.w,
            projP2.x, projP2.y, projP2.w
        );
    }
    
    // Draw Rear Sprites (Back to Front)
    for (let i = visibleSpritesRear.length - 1; i >= 0; i--) {
        const s = visibleSpritesRear[i];
        if (s.y < s.clipY) continue;
        
        const spriteWidth = s.sprite.width * s.scale;
        const spriteHeight = s.sprite.height * s.scale;
        const destX = s.x - (spriteWidth / 2);
        const destY = s.y - spriteHeight; 
        
        if (s.sprite.type === 'boost_powerup') {
            targetGraphics.fillStyle(0xFFFF00); 
        } else if (s.sprite.speed !== 0) {
            targetGraphics.fillStyle(0x0000FF); 
        } else {
            targetGraphics.fillStyle(0xFF0000); 
        } 
        targetGraphics.fillRect(destX, destY, spriteWidth, spriteHeight);
    }
  }

  private project(p: Point, width: number, height: number, roadWidth: number) {
    const scale = this.cameraDepth / (p.z || 1);
    
    return {
        x: (width / 2) + (scale * p.x * (width / 2)),
        y: (height / 2) - (scale * p.y * (height / 2)), 
        w: scale * roadWidth * (width / 2)
    };
  }
  
  private projectRear(p: Point, viewport: Phaser.Geom.Rectangle, roadWidth: number) {
      const scale = this.cameraDepth / (p.z || 1);
      
      const cx = viewport.centerX;
      // Adjusted Horizon: Shift horizon UP to 25% of viewport height
      const cy = viewport.y + (viewport.height * 0.25); 
      
      return {
          // Invert X for mirror reflection
          x: cx + (scale * -p.x * (viewport.width / 2)),
          y: cy - (scale * p.y * (viewport.height / 2)),
          w: scale * roadWidth * (viewport.width / 2)
      };
  }

  private renderSegment(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    color: { road: number; grass: number; rumble: number },
    x1: number, y1: number, w1: number,
    x2: number, y2: number, w2: number
  ) {
    graphics.fillStyle(color.grass);
    // Draw massive grass rect to cover background
    graphics.fillPoints([
        { x: x1 - 5000, y: y2 },
        { x: x1 - 5000, y: y1 },
        { x: x2 + 5000, y: y1 },
        { x: x2 + 5000, y: y2 }
    ]);

    const r1 = w1 / 4;
    const r2 = w2 / 4;
    graphics.fillStyle(color.rumble);
    graphics.fillPoints([
        { x: x1 - w1 - r1, y: y1 },
        { x: x1 - w1, y: y1 },
        { x: x2 - w2, y: y2 },
        { x: x2 - w2 - r2, y: y2 }
    ], true);
    graphics.fillPoints([
        { x: x1 + w1 + r1, y: y1 },
        { x: x1 + w1, y: y1 },
        { x: x2 + w2, y: y2 },
        { x: x2 + w2 + r2, y: y2 }
    ], true);

    graphics.fillStyle(color.road);
    graphics.fillPoints([
      { x: x1 - w1, y: y1 },
      { x: x1 + w1, y: y1 },
      { x: x2 + w2, y: y2 },
      { x: x2 - w2, y: y2 }
    ], true);
  }
}

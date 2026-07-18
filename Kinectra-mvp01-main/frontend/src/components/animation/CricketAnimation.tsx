import React, { useEffect, useRef } from "react";

interface UIRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function CricketAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiRectsRef = useRef<UIRect[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Physics parameters for realistic ball movement
    const ball = {
      x: width * 0.1,
      y: height * 0.4,
      radius: 12,
      vx: 4.5,
      vy: -5,
      gravity: 0.18,
      bounce: 0.78,
      friction: 0.995,
    };

    // Cricket bat state
    const bat = {
      x: width * 0.6,
      y: height * 0.7,
      width: 14,
      height: 80,
      angle: -45, // In degrees
      swinging: false,
      swingProgress: 0,
      active: false,
      opacity: 0,
    };

    // DOM Scanner to detect interactive UI elements
    const scanUI = () => {
      const rects: UIRect[] = [];
      // Select interactive elements
      const elements = document.querySelectorAll(
        "header, button, a, [role='button'], .pointer-events-auto, #ai-coach-trigger, [id*='dashboard']"
      );

      elements.forEach((el) => {
        // Skip canvas itself or elements that are full screen or close to it
        if (el.tagName === "CANVAS" || el.id === "analytics-dashboard-section") return;
        
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.width < width * 0.95 && r.height < height * 0.95) {
          rects.push({
            left: r.left - 8,   // Add safety padding of 8px
            right: r.right + 8,
            top: r.top - 8,
            bottom: r.bottom + 8,
          });
        }
      });
      uiRectsRef.current = rects;
    };

    // Initial scan and periodic scan every 1000ms
    scanUI();
    const scanInterval = setInterval(scanUI, 1000);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      scanUI();
    };

    window.addEventListener("resize", handleResize);

    let animationFrameId: number;
    let nextSwingTime = Date.now() + 6000; // First bat swing in 6s

    const drawBall = () => {
      if (!ctx) return;

      // Draw shadow
      ctx.beginPath();
      ctx.arc(ball.x + 4, ball.y + 4, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fill();

      // Radial gradient body
      const gradient = ctx.createRadialGradient(
        ball.x - 3,
        ball.y - 3,
        2,
        ball.x,
        ball.y,
        ball.radius
      );
      gradient.addColorStop(0, "#ff6b6b");
      gradient.addColorStop(0.3, "#cc1111");
      gradient.addColorStop(1, "#800000");

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Ball seam
      ctx.beginPath();
      ctx.ellipse(ball.x, ball.y, ball.radius, ball.radius / 3.5, Math.PI / 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(240, 240, 240, 0.7)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawBat = () => {
      if (!ctx || !bat.active) return;

      ctx.save();
      ctx.translate(bat.x, bat.y);
      ctx.rotate((bat.angle * Math.PI) / 180);
      ctx.globalAlpha = bat.opacity;

      // Draw bat blade
      const handleHeight = bat.height * 0.35;
      ctx.fillStyle = "#c68a4c"; // wood
      ctx.fillRect(-bat.width / 2, handleHeight, bat.width, bat.height - handleHeight);

      // Draw bat handle grip
      ctx.fillStyle = "#e11d48"; // vibrant grip color
      ctx.fillRect(-bat.width / 3, 0, (bat.width * 2) / 3, handleHeight);

      // Draw grain lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-bat.width / 4, handleHeight);
      ctx.lineTo(-bat.width / 4, bat.height - 4);
      ctx.stroke();

      ctx.restore();
    };

    const checkCollision = () => {
      if (!bat.active || !bat.swinging) return;

      const bladeX = bat.x + (Math.sin((bat.angle * Math.PI) / 180) * bat.height) / 2;
      const bladeY = bat.y + (Math.cos((bat.angle * Math.PI) / 180) * bat.height) / 2;

      const dx = ball.x - bladeX;
      const dy = ball.y - bladeY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ball.radius + bat.height / 2) {
        ball.vx = -10 - Math.random() * 5;
        ball.vy = -12 - Math.random() * 5;
        ball.x = bladeX - ball.radius - 8;
        createSparks(ball.x, ball.y);
      }
    };

    let sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = [];
    const createSparks = (x: number, y: number) => {
      for (let i = 0; i < 15; i++) {
        sparks.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8 - 2,
          life: 25 + Math.random() * 20,
          color: Math.random() > 0.4 ? "#f43f5e" : "#e11d48",
        });
      }
    };

    const drawSparks = () => {
      if (!ctx) return;
      sparks.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life--;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 45;
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
      sparks = sparks.filter((p) => p.life > 0);
    };

    const update = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // 1. Move ball
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vy += ball.gravity;
      ball.vx *= ball.friction;
      ball.vy *= ball.friction;

      // 2. Bounce off screen boundaries
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = -ball.vx * ball.bounce;
      } else if (ball.x + ball.radius > width) {
        ball.x = width - ball.radius;
        ball.vx = -ball.vx * ball.bounce;
      }

      if (ball.y + ball.radius > height - 20) {
        ball.y = height - 20 - ball.radius;
        ball.vy = -ball.vy * ball.bounce;
        ball.vx += (Math.random() - 0.5) * 0.8;
      } else if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy * ball.bounce;
      }

      // 3. Bounce off DOM Interactive UI elements boundaries
      uiRectsRef.current.forEach((rect) => {
        // Closest point on AABB to circle center
        const cx = Math.max(rect.left, Math.min(ball.x, rect.right));
        const cy = Math.max(rect.top, Math.min(ball.y, rect.bottom));
        
        const dx = ball.x - cx;
        const dy = ball.y - cy;
        const distSq = dx * dx + dy * dy;

        if (distSq < ball.radius * ball.radius) {
          const dist = Math.sqrt(distSq);
          const overlap = ball.radius - dist;

          // Normal direction from rect to circle
          let nx = dist > 0 ? dx / dist : 0;
          let ny = dist > 0 ? dy / dist : -1;

          if (dist === 0) {
            // Circle center inside box; push out to closest edge
            const dl = ball.x - rect.left;
            const dr = rect.right - ball.x;
            const dt = ball.y - rect.top;
            const db = rect.bottom - ball.y;
            const m = Math.min(dl, dr, dt, db);
            if (m === dl) { nx = -1; ny = 0; }
            else if (m === dr) { nx = 1; ny = 0; }
            else if (m === dt) { nx = 0; ny = -1; }
            else { nx = 0; ny = 1; }
          }

          // Reflect velocity along normal
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * nx) * ball.bounce;
            ball.vy = (ball.vy - 2 * dot * ny) * ball.bounce;
          }

          // Push ball outside the box
          ball.x += nx * (overlap + 2);
          ball.y += ny * (overlap + 2);
        }
      });

      // 4. Bat trigger
      const now = Date.now();
      if (now > nextSwingTime && !bat.active) {
        // Try positioning bat relative to current ball position
        let cleanSpawnFound = false;
        let attempts = 0;
        
        while (attempts < 8) {
          const offset = ball.vx > 0 ? 80 : -80;
          let candidateX = ball.x + offset;
          let candidateY = ball.y - 30;

          candidateX = Math.max(100, Math.min(width - 100, candidateX));
          candidateY = Math.max(100, Math.min(height - 200, candidateY));

          // Check if candidate overlaps UI boxes
          const overlapsUI = uiRectsRef.current.some((rect) => {
            return (
              candidateX + 30 > rect.left &&
              candidateX - 30 < rect.right &&
              candidateY + 90 > rect.top &&
              candidateY - 10 < rect.bottom
            );
          });

          if (!overlapsUI) {
            bat.x = candidateX;
            bat.y = candidateY;
            cleanSpawnFound = true;
            break;
          }
          
          // Jitter and retry
          attempts++;
        }

        if (cleanSpawnFound) {
          bat.active = true;
          bat.swinging = true;
          bat.swingProgress = 0;
          bat.angle = -60;
          bat.opacity = 0;
          nextSwingTime = now + 15000 + Math.random() * 10000;
        } else {
          // Retry spawning shortly if UI area was too crowded
          nextSwingTime = now + 3000;
        }
      }

      // 5. Swing lifecycle
      if (bat.active) {
        if (bat.swinging) {
          if (bat.opacity < 1.0) bat.opacity += 0.2;
          bat.swingProgress += 0.07;
          bat.angle = -60 + 120 * Math.sin((bat.swingProgress * Math.PI) / 2);
          checkCollision();

          if (bat.swingProgress >= 1.0) {
            bat.swinging = false;
          }
        } else {
          bat.opacity -= 0.1;
          if (bat.opacity <= 0) {
            bat.active = false;
          }
        }
      }

      // Draw
      drawSparks();
      drawBall();
      drawBat();

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      clearInterval(scanInterval);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full z-30 pointer-events-none"
    />
  );
}

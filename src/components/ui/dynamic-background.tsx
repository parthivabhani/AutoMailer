import { useEffect, useRef } from "react";

export function DynamicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with easing
    const mouse = { x: width / 2, y: height / 2, targetX: width / 2, targetY: height / 2 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    // Orb class definition
    class Orb {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      radius: number;
      speedX: number;
      speedY: number;
      color: string;
      colorDark: string;
      angle: number;
      angleSpeed: number;
      orbitRadius: number;

      constructor(x: number, y: number, radius: number, color: string, colorDark: string) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.radius = radius;
        this.color = color;
        this.colorDark = colorDark;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.angle = Math.random() * Math.PI * 2;
        this.angleSpeed = (Math.random() - 0.5) * 0.005;
        this.orbitRadius = 30 + Math.random() * 50;
      }

      update(isDark: boolean) {
        // Subtle drift
        this.angle += this.angleSpeed;
        this.baseX += this.speedX;
        this.baseY += this.speedY;

        // Bounce off bounds
        if (this.baseX < -this.radius || this.baseX > width + this.radius) {
          this.speedX *= -1;
        }
        if (this.baseY < -this.radius || this.baseY > height + this.radius) {
          this.speedY *= -1;
        }

        // Apply mouse parallax with easing
        const dx = mouse.x - width / 2;
        const dy = mouse.y - height / 2;
        this.x = this.baseX + dx * 0.03 + Math.cos(this.angle) * this.orbitRadius;
        this.y = this.baseY + dy * 0.03 + Math.sin(this.angle) * this.orbitRadius;
      }

      draw(context: CanvasRenderingContext2D, isDark: boolean) {
        const grad = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        const colorString = isDark ? this.colorDark : this.color;
        grad.addColorStop(0, colorString);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");

        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = grad;
        context.fill();
      }
    }

    // Creating beautiful pastel orbs for light / dark modes
    const orbs = [
      // Violet orb
      new Orb(
        width * 0.25,
        height * 0.3,
        Math.min(width, height) * 0.35,
        "rgba(129, 140, 248, 0.08)", // Light
        "rgba(99, 102, 241, 0.15)", // Dark
      ),
      // Pink/Fuchsia orb
      new Orb(
        width * 0.75,
        height * 0.4,
        Math.min(width, height) * 0.4,
        "rgba(244, 114, 182, 0.06)",
        "rgba(219, 39, 119, 0.1)",
      ),
      // Cyan/Blue orb
      new Orb(
        width * 0.5,
        height * 0.8,
        Math.min(width, height) * 0.38,
        "rgba(103, 232, 249, 0.06)",
        "rgba(6, 182, 212, 0.09)",
      ),
    ];

    const render = () => {
      // Smooth interpolation for mouse coordinates
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const isDark = document.documentElement.classList.contains("dark");

      ctx.clearRect(0, 0, width, height);

      // Render all orbs
      orbs.forEach((orb) => {
        orb.update(isDark);
        orb.draw(ctx, isDark);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none -z-10"
      style={{ filter: "blur(40px)" }}
    />
  );
}

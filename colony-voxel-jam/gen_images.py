import json, math, colorsys, os
from PIL import Image, ImageDraw

N = 32; S = 8; SZ = N * S; K = SZ / 100.0
BG = (255, 255, 255)
DK = '#2a2233'; WH = '#f8f6f0'


class Cv:
    def __init__(s):
        s.im = Image.new('RGB', (SZ, SZ), BG); s.d = ImageDraw.Draw(s.im)
    def E(s, x, y, rx, ry, c): s.d.ellipse([(x-rx)*K, (y-ry)*K, (x+rx)*K, (y+ry)*K], fill=c)
    def R(s, x, y, w, h, c): s.d.rectangle([x*K, y*K, (x+w)*K, (y+h)*K], fill=c)
    def RR(s, x, y, w, h, r, c): s.d.rounded_rectangle([x*K, y*K, (x+w)*K, (y+h)*K], radius=r*K, fill=c)
    def P(s, pts, c): s.d.polygon([(a*K, b*K) for a, b in pts], fill=c)
    def A(s, x, y, r, a0, a1, c): s.d.pieslice([(x-r)*K, (y-r)*K, (x+r)*K, (y+r)*K], a0, a1, fill=c)
    def L(s, x0, y0, x1, y1, w, c):
        s.d.line([x0*K, y0*K, x1*K, y1*K], fill=c, width=max(1, int(w*K)))
        s.E(x0, y0, w/2, w/2, c); s.E(x1, y1, w/2, w/2, c)


def eyes(c, x1, x2, y, r=4.2): c.E(x1, y, r, r*1.15, DK); c.E(x2, y, r, r*1.15, DK)
def cheeks(c, x1, x2, y, col='#ff8fa3'): c.E(x1, y, 5, 3.6, col); c.E(x2, y, 5, 3.6, col)


def corgi(c):
    c.P([(12, 8), (36, 28), (8, 44)], '#c9702a'); c.P([(88, 8), (64, 28), (92, 44)], '#c9702a')
    c.E(50, 56, 40, 36, '#f6a43c'); c.E(50, 70, 26, 20, WH); c.P([(50, 24), (61, 50), (39, 50)], WH)
    eyes(c, 32, 68, 52); c.E(50, 64, 6.5, 4.8, DK); c.E(50, 79, 5, 6, '#ff6f91'); cheeks(c, 20, 80, 66)

def cat(c):
    c.P([(12, 6), (40, 26), (10, 46)], '#8d8d99'); c.P([(88, 6), (60, 26), (90, 46)], '#8d8d99')
    c.P([(17, 16), (33, 28), (17, 38)], '#ffb3c6'); c.P([(83, 16), (67, 28), (83, 38)], '#ffb3c6')
    c.E(50, 58, 40, 34, '#a9a9b8')
    for x in (38, 50, 62): c.R(x-1.6, 28, 3.4, 10, '#6f6f80')
    c.E(33, 56, 6, 7, '#7bd88f'); c.E(67, 56, 6, 7, '#7bd88f'); c.E(33, 56, 2.6, 5.6, DK); c.E(67, 56, 2.6, 5.6, DK)
    c.P([(44, 68), (56, 68), (50, 75)], '#ff7aa2'); cheeks(c, 20, 80, 72)

def panda(c):
    c.E(20, 24, 13, 13, DK); c.E(80, 24, 13, 13, DK); c.E(50, 56, 40, 36, WH)
    c.E(32, 52, 10, 13, DK); c.E(68, 52, 10, 13, DK); c.E(33, 52, 3.8, 4.4, WH); c.E(67, 52, 3.8, 4.4, WH)
    c.E(50, 68, 7, 5, DK); c.E(50, 80, 6, 3, '#ff7aa2')

def bunny(c):
    c.E(34, 24, 10, 24, '#d9c2ff'); c.E(66, 24, 10, 24, '#d9c2ff'); c.E(34, 26, 4.6, 16, '#ffb3c6'); c.E(66, 26, 4.6, 16, '#ffb3c6')
    c.E(50, 66, 36, 30, '#d9c2ff'); eyes(c, 35, 65, 62); c.E(50, 72, 5, 4, '#ff7aa2'); cheeks(c, 24, 76, 74); c.E(50, 82, 8, 5, WH)

def frog(c):
    c.E(50, 64, 44, 30, '#5fd068'); c.E(28, 34, 15, 15, '#5fd068'); c.E(72, 34, 15, 15, '#5fd068')
    c.E(28, 34, 9, 9, WH); c.E(72, 34, 9, 9, WH); c.E(28, 35, 4.4, 5, DK); c.E(72, 35, 4.4, 5, DK)
    c.E(50, 74, 26, 11, '#e0505f'); c.E(50, 68, 24, 4, '#5fd068'); c.E(18, 66, 5, 3.6, '#ff8fa3'); c.E(82, 66, 5, 3.6, '#ff8fa3')

def owl(c):
    c.P([(12, 6), (38, 22), (12, 36)], '#8a5a3c'); c.P([(88, 6), (62, 22), (88, 36)], '#8a5a3c')
    c.E(50, 58, 40, 40, '#a8714a'); c.E(50, 74, 24, 20, '#f1d9b5')
    for x in (32, 68): c.E(x, 44, 15, 15, WH); c.E(x, 44, 9, 9, '#ffb703'); c.E(x, 45, 4.6, 5, DK)
    c.P([(43, 54), (57, 54), (50, 68)], '#ff7a1a'); c.E(36, 96, 9, 4, '#ff7a1a'); c.E(64, 96, 9, 4, '#ff7a1a')

def penguin(c):
    c.E(14, 60, 9, 22, '#2f3a63'); c.E(86, 60, 9, 22, '#2f3a63')
    c.E(50, 52, 36, 44, '#2f3a63'); c.E(50, 64, 24, 30, WH)
    for x in (38, 62): c.E(x, 36, 7, 8, WH); c.E(x, 37, 3.4, 4.2, DK)
    c.P([(42, 46), (58, 46), (50, 58)], '#ff9f1c'); c.E(34, 94, 12, 5, '#ff9f1c'); c.E(66, 94, 12, 5, '#ff9f1c')

def fox(c):
    c.P([(6, 6), (42, 30), (8, 52)], '#e8590c'); c.P([(94, 6), (58, 30), (92, 52)], '#e8590c')
    c.P([(10, 44), (50, 22), (90, 44), (72, 84), (50, 94), (28, 84)], '#ff7b1c')
    c.P([(12, 56), (50, 66), (88, 56), (50, 96)], WH); c.P([(50, 66), (38, 56), (62, 56)], '#ff7b1c')
    eyes(c, 33, 67, 48); c.E(50, 86, 5.5, 4.5, DK)

def pig(c):
    c.P([(12, 10), (42, 22), (16, 42)], '#ff7aa2'); c.P([(88, 10), (58, 22), (84, 42)], '#ff7aa2')
    c.E(50, 54, 42, 38, '#ffa6c1'); c.E(50, 66, 20, 15, '#ff7aa2')
    c.E(42, 66, 3.6, 5, '#b83266'); c.E(58, 66, 3.6, 5, '#b83266'); eyes(c, 28, 72, 44); cheeks(c, 16, 84, 60, '#ff6b9a')

def bear(c):
    c.E(18, 24, 14, 14, '#8b5a2b'); c.E(82, 24, 14, 14, '#8b5a2b'); c.E(18, 24, 6.5, 6.5, '#e0b27a'); c.E(82, 24, 6.5, 6.5, '#e0b27a')
    c.E(50, 56, 42, 38, '#a56a37'); c.E(50, 70, 21, 17, '#e8c28f'); eyes(c, 32, 68, 48); c.E(50, 64, 7, 5, DK); c.R(48.4, 66, 3.4, 8, DK)

def chick(c):
    c.P([(50, 4), (42, 18), (58, 18)], '#f5b800'); c.E(50, 56, 42, 40, '#ffd23f')
    c.E(12, 62, 9, 18, '#f5b800'); c.E(88, 62, 9, 18, '#f5b800')
    eyes(c, 34, 66, 46); c.P([(42, 54), (58, 54), (50, 66)], '#ff8c1a'); cheeks(c, 22, 78, 62)
    c.R(34, 92, 6, 6, '#ff8c1a'); c.R(60, 92, 6, 6, '#ff8c1a')

def fish(c):
    c.P([(66, 50), (96, 22), (96, 78)], '#ff9f1c'); c.E(42, 50, 38, 28, '#4cc9f0')
    c.P([(26, 26), (50, 8), (58, 30)], '#3a86ff'); c.P([(40, 74), (56, 92), (62, 72)], '#3a86ff')
    c.E(50, 50, 6, 24, '#3a86ff'); c.E(68, 50, 5, 18, '#3a86ff')
    c.E(22, 44, 6.5, 7, WH); c.E(22, 45, 3.2, 3.6, DK); c.E(10, 58, 4, 2.6, '#e0505f')

def ladybug(c):
    c.L(42, 14, 34, 4, 3.4, DK); c.L(58, 14, 66, 4, 3.4, DK)
    c.E(50, 24, 17, 14, DK); c.E(42, 22, 4.4, 4.4, WH); c.E(58, 22, 4.4, 4.4, WH)
    c.E(50, 62, 42, 36, '#e63946'); c.R(47.6, 32, 5, 66, DK)
    for x, y in ((28, 52), (72, 52), (32, 76), (68, 76)): c.E(x, y, 6.5, 6.5, DK)

def butterfly(c):
    c.E(26, 32, 24, 24, '#ff5d8f'); c.E(74, 32, 24, 24, '#ff5d8f'); c.E(32, 72, 19, 20, '#ffb703'); c.E(68, 72, 19, 20, '#ffb703')
    c.E(24, 30, 9, 9, WH); c.E(76, 30, 9, 9, WH); c.E(32, 72, 8, 8, '#ff5d8f'); c.E(68, 72, 8, 8, '#ff5d8f')
    c.E(50, 52, 6, 32, DK); c.L(46, 24, 36, 8, 3.4, DK); c.L(54, 24, 64, 8, 3.4, DK)

def snail(c):
    c.RR(6, 72, 88, 18, 9, '#9be564'); c.E(86, 50, 10, 24, '#9be564')
    c.L(82, 30, 78, 14, 3.4, '#9be564'); c.L(90, 30, 94, 14, 3.4, '#9be564'); c.E(84, 42, 3.6, 4.2, DK)
    c.E(42, 52, 34, 34, '#c77d3a'); c.E(42, 52, 24, 24, '#e09f50'); c.E(42, 52, 14, 14, '#c77d3a'); c.E(42, 52, 5.5, 5.5, '#e09f50')

def bee(c):
    c.E(34, 28, 20, 14, '#bfe9ff'); c.E(62, 24, 20, 14, '#bfe9ff')
    c.P([(2, 62), (14, 54), (14, 70)], DK); c.E(46, 62, 36, 28, '#ffd23f')
    c.R(30, 42, 10, 40, DK); c.R(52, 40, 10, 44, DK)
    c.E(80, 58, 14, 15, '#3b2a20'); c.E(84, 54, 4.2, 4.6, WH); c.E(84, 55, 2, 2.4, DK)

def watermelon(c):
    c.A(50, 24, 46, 0, 180, '#2e9e4f'); c.A(50, 24, 40, 0, 180, '#d7f7a5'); c.A(50, 24, 35, 0, 180, '#ff4d6d')
    for x, y in ((32, 42), (50, 52), (68, 42), (40, 62), (60, 62)): c.E(x, y, 3.4, 4.8, DK)

def mushroom(c):
    c.RR(32, 48, 36, 44, 10, '#fff0d4'); c.A(50, 54, 44, 180, 360, '#e63946'); c.R(6, 52, 88, 7, '#b02a37')
    c.E(50, 26, 9, 7, WH); c.E(24, 42, 7, 6, WH); c.E(76, 42, 7, 6, WH)
    c.E(42, 70, 3.8, 4.6, DK); c.E(58, 70, 3.8, 4.6, DK); cheeks(c, 36, 64, 80)

def cupcake(c):
    c.P([(16, 52), (84, 52), (73, 96), (27, 96)], '#f4a261')
    for x in (34, 50, 66): c.P([(x-3, 52), (x+3, 52), (x+2, 96), (x-3, 96)], '#e07a3c')
    c.E(50, 48, 36, 14, '#ff8fab'); c.E(50, 32, 27, 13, '#ffb3c6'); c.E(50, 18, 17, 10, '#ff8fab'); c.E(50, 8, 6, 6, '#e63946')

def icecream(c):
    c.P([(28, 54), (72, 54), (50, 98)], '#e9b266'); c.L(36, 58, 56, 86, 3.2, '#c98a3c'); c.L(64, 58, 44, 86, 3.2, '#c98a3c')
    c.E(50, 44, 28, 20, '#ff8fab'); c.E(28, 54, 8, 8, '#ff8fab'); c.E(72, 54, 8, 8, '#ff8fab')
    c.E(50, 24, 21, 18, '#7bdff2'); c.E(50, 7, 5.5, 5.5, '#e63946')

def apple(c):
    c.E(34, 60, 30, 34, '#e63946'); c.E(66, 60, 30, 34, '#e63946'); c.E(50, 66, 32, 30, '#e63946')
    c.R(47, 18, 6, 18, '#6b4423'); c.P([(54, 24), (62, 10), (84, 12), (72, 28)], '#4cc552'); c.E(28, 52, 6, 11, '#ff8b94')

def strawberry(c):
    c.E(34, 46, 27, 26, '#e63946'); c.E(66, 46, 27, 26, '#e63946'); c.P([(8, 54), (92, 54), (50, 98)], '#e63946')
    c.R(47, 4, 6, 12, '#2f8f3a'); c.P([(24, 28), (50, 12), (76, 28), (62, 38), (50, 30), (38, 38)], '#3cb44b')
    for x, y in ((34, 52), (50, 48), (66, 52), (42, 68), (58, 68), (50, 82)): c.E(x, y, 3, 3.8, '#ffe066')

def pizza(c):
    c.P([(50, 98), (4, 20), (96, 20)], '#d98b3a'); c.P([(50, 88), (14, 28), (86, 28)], '#ffd35c'); c.RR(2, 8, 96, 16, 8, '#d98b3a')
    for x, y, r in ((36, 40, 8), (64, 40, 8), (50, 62, 8)): c.E(x, y, r, r, '#d62828')
    c.E(50, 42, 4, 4, '#3a7d2c'); c.E(40, 62, 3.4, 3.4, '#3a7d2c'); c.E(62, 64, 3.4, 3.4, '#3a7d2c')

def donut(c):
    c.E(50, 56, 46, 40, '#e0a96d'); c.E(50, 50, 44, 38, '#ff8fc7'); c.E(50, 50, 14, 12, BG)
    for (x0, y0, x1, y1, col) in ((24, 40, 31, 35, '#ffd23f'), (66, 32, 73, 37, '#3a86ff'), (28, 64, 35, 68, '#7bd88f'),
                                   (68, 66, 75, 61, '#f8f6f0'), (46, 26, 52, 23, '#8e44ad'), (78, 50, 83, 54, '#ffd23f')):
        c.L(x0, y0, x1, y1, 4, col)

def cherries(c):
    c.L(30, 66, 52, 14, 3.8, '#3f8f3a'); c.L(70, 64, 52, 14, 3.8, '#3f8f3a'); c.P([(52, 14), (78, 4), (90, 18), (64, 24)], '#4cc552')
    c.E(30, 74, 21, 21, '#d62839'); c.E(70, 72, 21, 21, '#d62839'); c.E(22, 66, 5, 6.5, '#ff8b94'); c.E(62, 64, 5, 6.5, '#ff8b94')

def carrot(c):
    c.P([(24, 38), (76, 38), (50, 98)], '#ff8a1f'); c.E(50, 38, 26, 12, '#ff8a1f')
    for x0, y0, x1, y1 in ((36, 48, 46, 52), (56, 62, 66, 58), (42, 72, 52, 76)): c.L(x0, y0, x1, y1, 3.4, '#e06c00')
    c.E(36, 16, 8, 18, '#4cc552'); c.E(50, 10, 8, 18, '#3cb44b'); c.E(64, 16, 8, 18, '#4cc552')

def crown(c):
    c.P([(8, 78), (8, 32), (32, 54), (50, 18), (68, 54), (92, 32), (92, 78)], '#ffc300'); c.RR(8, 66, 84, 15, 3, '#f08a00')
    c.E(50, 73, 5.5, 5, '#ef233c'); c.E(27, 73, 4.6, 4.6, '#3a86ff'); c.E(73, 73, 4.6, 4.6, '#3a86ff')
    c.E(8, 31, 6, 6, '#ef233c'); c.E(92, 31, 6, 6, '#ef233c'); c.E(50, 17, 6.5, 6.5, '#ef233c')

def ghost(c):
    col = '#bfc8ff'
    c.A(50, 46, 36, 180, 360, col); c.R(14, 46, 72, 38, col)
    for x in (23, 41, 59, 77): c.E(x, 84, 9, 10, col)
    c.E(38, 44, 5.4, 8, DK); c.E(62, 44, 5.4, 8, DK); c.E(50, 62, 5, 6.5, DK); cheeks(c, 26, 74, 56, '#ff8fab')

def car(c):
    c.RR(8, 50, 84, 28, 9, '#e63946'); c.RR(24, 26, 52, 30, 10, '#e63946')
    c.RR(29, 32, 19, 17, 3, '#bde0fe'); c.RR(52, 32, 19, 17, 3, '#bde0fe')
    c.E(28, 78, 13, 13, DK); c.E(72, 78, 13, 13, DK); c.E(28, 78, 5.5, 5.5, '#c9d1d9'); c.E(72, 78, 5.5, 5.5, '#c9d1d9')
    c.E(90, 60, 4.6, 5.4, '#ffd60a'); c.R(8, 68, 12, 6, '#b02a37')

def rocket(c):
    c.P([(32, 62), (12, 88), (40, 78)], '#ef233c'); c.P([(68, 62), (88, 88), (60, 78)], '#ef233c')
    c.P([(38, 78), (50, 100), (62, 78)], '#ffb703'); c.P([(44, 78), (50, 90), (56, 78)], '#ff6d00')
    c.E(50, 46, 18, 36, '#dfe7ee'); c.P([(33, 30), (50, 2), (67, 30)], '#ef233c'); c.E(50, 44, 9, 9, '#4cc9f0'); c.E(50, 44, 5, 5, '#2b8fc0')

def flower(c):
    c.R(47, 50, 6, 48, '#2e9e4f'); c.E(32, 78, 14, 6.5, '#57cc99'); c.E(68, 68, 14, 6.5, '#57cc99')
    for k in range(6):
        a = k / 6 * math.pi * 2; c.E(50 + math.cos(a) * 21, 34 + math.sin(a) * 21, 14, 14, '#ff4d8d')
    c.E(50, 34, 12, 12, '#ffd60a'); c.E(50, 34, 5, 5, '#fb8500')

def heartpts(cx, cy, s):
    pts = []
    for i in range(72):
        t = 2 * math.pi * i / 72
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s, cy - y * s))
    return pts

def rheart(c):
    cols = ['#ff9f1c', '#ffe14d', '#6ee05a', '#3cc6f4', '#6a5cff', '#c04bff', '#ff7ac8', '#fff0f6']
    for i, col in enumerate(cols): c.P(heartpts(50, 46 + i * 1.6, 2.9 * (1 - i * 0.115)), col)

def star(c):
    for r0, r1, col in ((47, 21, '#ff9f1c'), (38, 17, '#ffc300')):
        pts = [(50 + (r0 if i % 2 == 0 else r1) * (1 if col == '#ff9f1c' else 1) * math.cos(-math.pi/2 + i*math.pi/5) * (r0 / r0),
                56 + (r0 if i % 2 == 0 else r1) * math.sin(-math.pi/2 + i*math.pi/5)) for i in range(10)]
        c.P(pts, col)
    eyes(c, 41, 59, 52, 3.4); c.E(50, 64, 4.4, 3.2, '#c0392b'); cheeks(c, 32, 68, 62)

def balloon(c):
    c.E(50, 38, 31, 35, '#ff4d6d'); c.P([(43, 70), (57, 70), (50, 79)], '#d62839')
    c.L(50, 79, 42, 90, 3.2, '#8d99ae'); c.L(42, 90, 56, 98, 3.2, '#8d99ae'); c.E(37, 26, 6.5, 11, '#ff9aa8')

def gem(c):
    c.P([(24, 20), (76, 20), (95, 42), (50, 96), (5, 42)], '#3ac7f4')
    c.P([(24, 20), (50, 20), (38, 42), (5, 42)], '#7be0ff'); c.P([(50, 20), (76, 20), (95, 42), (62, 42)], '#25a0d8')
    c.P([(38, 42), (62, 42), (50, 96)], '#1f8cc9'); c.P([(5, 42), (38, 42), (50, 96)], '#4fd0f7')

def house(c):
    c.R(66, 12, 14, 26, '#a0522d'); c.RR(16, 46, 68, 48, 3, '#ffe6b0'); c.P([(4, 52), (50, 8), (96, 52)], '#e63946')
    c.RR(42, 66, 16, 28, 3, '#8b5a2b'); c.RR(22, 58, 15, 15, 2, '#7bdff2'); c.RR(63, 58, 15, 15, 2, '#7bdff2'); c.E(55, 80, 2, 2, '#ffd60a')


MOTIFS = [
    (corgi, 'corgi'), (cat, 'gato'), (panda, 'panda'), (bunny, 'coelho'), (frog, 'sapo'), (owl, 'coruja'),
    (penguin, 'pinguim'), (fox, 'raposa'), (pig, 'porquinho'), (bear, 'urso'), (chick, 'pintinho'), (fish, 'peixe'),
    (ladybug, 'joaninha'), (butterfly, 'borboleta'), (snail, 'caracol'), (bee, 'abelha'),
    (watermelon, 'melancia'), (mushroom, 'cogumelo'), (cupcake, 'cupcake'), (icecream, 'sorvete'), (apple, 'maçã'),
    (strawberry, 'morango'), (pizza, 'pizza'), (donut, 'rosquinha'), (cherries, 'cerejas'), (carrot, 'cenoura'),
    (crown, 'coroa'), (ghost, 'fantasma'), (car, 'carrinho'), (rocket, 'foguete'), (flower, 'flor'),
    (rheart, 'coração arco-íris'), (star, 'estrela'), (balloon, 'balão'), (gem, 'diamante'), (house, 'casinha'),
]
HUES = (0, 100, 215)


def shift(im, deg):
    if deg == 0: return im
    out = im.copy(); px = out.load(); cache = {}
    for y in range(out.height):
        for x in range(out.width):
            col = px[x, y]
            if col == BG: continue
            if col not in cache:
                h, s, v = colorsys.rgb_to_hsv(*[q / 255 for q in col])
                if s < 0.17 or v < 0.25: cache[col] = col
                else:
                    r, g, b = colorsys.hsv_to_rgb((h + deg / 360) % 1, s, v)
                    cache[col] = (round(r * 255), round(g * 255), round(b * 255))
            px[x, y] = cache[col]
    return out


def main():
    os.makedirs('images', exist_ok=True)
    out = []
    for vi, deg in enumerate(HUES):
        for fn, name in MOTIFS:
            cv = Cv(); fn(cv)
            im = shift(cv.im, deg).resize((N, N), Image.NEAREST)
            px = im.load(); counts = {}
            for y in range(N):
                for x in range(N):
                    if px[x, y] != BG: counts[px[x, y]] = counts.get(px[x, y], 0) + 1
            order = sorted(counts, key=lambda k: -counts[k])
            idx = {c: i for i, c in enumerate(order)}
            b = ''.join('.' if px[x, y] == BG else format(idx[px[x, y]], 'x') for y in range(N) for x in range(N))
            filled = sum(counts.values())
            assert len(order) <= 15 and filled > 300, (name, vi, len(order), filled)
            label = name if vi == 0 else f'{name} · {vi + 1}'
            n = len(out) + 1
            out.append({'id': f'{n:03d}', 'name': label, 'p': ['#%02x%02x%02x' % c for c in order], 'b': b})
            im.resize((256, 256), Image.NEAREST).save(f'images/{n:03d}_{name.replace(" ", "_")}_{vi + 1}.png')
    json.dump(out, open('images.json', 'w'), ensure_ascii=False)
    for nm, items, cols, cell in (('sheet_motifs.png', out[:36], 6, 96), ('sheet_all.png', out, 12, 64)):
        rows = math.ceil(len(items) / cols); sh = Image.new('RGB', (cols * cell, rows * cell), '#dddddd')
        for i, it in enumerate(items):
            im = Image.open(f"images/{it['id']}_{[m for m in MOTIFS][int(it['id'])-1 - ((int(it['id'])-1)//36)*36][1].replace(' ', '_')}_{(int(it['id'])-1)//36 + 1}.png").resize((cell - 2, cell - 2), Image.NEAREST)
            sh.paste(im, ((i % cols) * cell + 1, (i // cols) * cell + 1))
        sh.save(nm)
    print(len(out), 'images')

main()

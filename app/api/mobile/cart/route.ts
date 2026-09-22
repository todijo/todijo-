import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { cartLineKey, normalizeCartOption } from "@/lib/cart-line";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";

type Line = { productId?: unknown; variantId?: unknown; quantity?: unknown; selectedColor?: unknown; selectedSize?: unknown };
const failure = (error: unknown) => error instanceof MobileSessionError
  ? NextResponse.json({ error: error.code }, { status: error.status })
  : NextResponse.json({ error: "CART_UNAVAILABLE" }, { status: 500 });

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request);
    const lines = await prisma.mobileCartLine.findMany({
      where: { userId: session.userId, product: { status: "PUBLISHED", ...publicProductAccessWhere() } },
      orderBy: { createdAt: "asc" },
      select: { productId: true, variantId: true, quantity: true, selectedColor: true, selectedSize: true, selectedOptions: true },
    });
    return NextResponse.json({ lines }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const session = await readMobileSession(request);
    const body = await request.json().catch(() => null);
    const raw = Array.isArray(body?.lines) ? body.lines as Line[] : null;
    if (!raw || raw.length > 100) return NextResponse.json({ error: "INVALID_CART" }, { status: 400 });
    const lines = raw.map(item => ({
      productId: typeof item.productId === "string" ? item.productId : "",
      variantId: normalizeCartOption(item.variantId),
      quantity: Number(item.quantity),
      selectedColor: normalizeCartOption(item.selectedColor),
      selectedSize: normalizeCartOption(item.selectedSize),
    }));
    if (lines.some(line => !line.productId || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 999))
      return NextResponse.json({ error: "INVALID_CART" }, { status: 400 });
    const keys = lines.map(line => cartLineKey(line.productId, line.selectedColor, line.selectedSize, line.variantId));
    if (new Set(keys).size !== keys.length || keys.some(key => key.length > 256))
      return NextResponse.json({ error: "INVALID_CART" }, { status: 400 });
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(lines.map(line => line.productId))] }, status: "PUBLISHED", ...publicProductAccessWhere() },
      select: { id: true, colors: true, sizes: true, variants: { select: { id: true, active: true } } },
    });
    const byId = new Map(products.map(product => [product.id, product]));
    if (lines.some(line => {
      const product = byId.get(line.productId);
      if (!product) return true;
      if (product.variants.length) return !line.variantId || !product.variants.some(variant => variant.id === line.variantId && variant.active);
      return Boolean(line.variantId) || Boolean(product.colors.length && !product.colors.includes(line.selectedColor ?? "")) || Boolean(product.sizes.length && !product.sizes.includes(line.selectedSize ?? ""));
    })) return NextResponse.json({ error: "INVALID_CART_ITEM" }, { status: 409 });
    await prisma.$transaction(async tx => {
      await tx.mobileCartLine.deleteMany({ where: { userId: session.userId } });
      if (lines.length) await tx.mobileCartLine.createMany({ data: lines.map((line, index) => ({
        ...line, userId: session.userId, lineKey: keys[index],
      })) });
    });
    return NextResponse.json({ ok: true, count: lines.length });
  } catch (error) { return failure(error); }
}

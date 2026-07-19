import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      currency: true,
      category: true,
      condition: true,
      stock: true,
      images: true,
      store: { select: { name: true, slug: true, city: true, country: true } },
    },
  });

  if (!product) notFound();

  return (
    <main className="productDetailPage">
      <header className="publicStoreHeader">
        <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
        <a className="secondary" href={`/store/${product.store.slug}`}>Boutique {product.store.name}</a>
      </header>
      <section className="productDetailShell">
        <div className="productGallery">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="productMainImage" src={product.images[0]} alt={product.name} />
          ) : <div className="productMainPlaceholder">📦</div>}
          {product.images.length > 1 && (
            <div className="productThumbs">
              {product.images.slice(1).map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" key={image} />
              ))}
            </div>
          )}
        </div>
        <article className="productDetailInfo">
          <p className="dashboardBadge">{product.category}</p>
          <h1>{product.name}</h1>
          <strong className="productDetailPrice">{product.price.toString()} {product.currency}</strong>
          <p className="productDetailDescription">{product.description}</p>
          <dl className="productFacts">
            <div><dt>État</dt><dd>{product.condition.replaceAll("_", " ")}</dd></div>
            <div><dt>Disponibilité</dt><dd>{product.stock > 0 ? `${product.stock} en stock` : "Rupture de stock"}</dd></div>
            <div><dt>Vendeur</dt><dd><a href={`/store/${product.store.slug}`}>{product.store.name}</a></dd></div>
            <div><dt>Lieu</dt><dd>{product.store.city}, {product.store.country}</dd></div>
          </dl>
          <button className="authSubmit addCartButton" type="button" disabled={product.stock === 0}>
            {product.stock > 0 ? "Ajouter au panier — bientôt" : "Indisponible"}
          </button>
        </article>
      </section>
    </main>
  );
}

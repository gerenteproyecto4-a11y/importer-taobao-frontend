"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { OtApiService } from "@/lib/api/otapi";
import { OTAPI_CONFIG } from "@/lib/api/config";
import type { ItemDetailResponse, ItemDetailConfiguration, OtapiItem } from "@/types/product";

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/600x600?text=Sin+Imagen";

function VariantCard({ configuration: cfg }: { configuration: ItemDetailConfiguration }) {
  const hasConfigurators = cfg.Configurators && cfg.Configurators.length > 0;
  return (
    <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1">
        {cfg.PriceRmb != null && (
          <span className="font-semibold text-orange-600 dark:text-orange-400">¥{cfg.PriceRmb.toFixed(2)}</span>
        )}
        {cfg.PriceUsd != null && (
          <span className="text-gray-600 dark:text-gray-300">US$ {cfg.PriceUsd.toFixed(2)}</span>
        )}
        {cfg.Quantity != null && cfg.Quantity > 0 && (
          <span className="text-gray-600 dark:text-gray-400">
            Stock: <strong>{cfg.Quantity.toLocaleString("es")}</strong>
          </span>
        )}
        {cfg.SalesCount != null && cfg.SalesCount > 0 && (
          <span className="text-gray-500 dark:text-gray-400">{cfg.SalesCount.toLocaleString("es")} vendidos</span>
        )}
      </div>
      {hasConfigurators && cfg.Configurators && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cfg.Configurators.map((c, i) => (
            <span
              key={`${c.Pid}-${c.Vid}-${i}`}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-600 text-xs font-mono text-gray-700 dark:text-gray-300"
              title={`Propiedad ${c.Pid} = Valor ${c.Vid}`}
            >
              <span className="text-gray-500 dark:text-gray-400">Pid:</span> {c.Pid}{" "}
              <span className="text-gray-500 dark:text-gray-400 ml-1">Vid:</span> {c.Vid}
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 font-mono truncate" title={cfg.Id}>
        ID: {cfg.Id}
      </div>
    </div>
  );
}

function formatPrice(item: OtapiItem, currency: "CNY" | "USD" | "COP" = "CNY") {
  const c = currency === "CNY" ? "¥" : currency === "USD" ? "US$" : "COP ";
  const n =
    currency === "CNY"
      ? item.PriceRMB
      : currency === "USD"
        ? item.PriceUSD
        : item.PriceCOP;
  return `${c}${typeof n === "number" ? n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = String(params?.itemId ?? "");
  const [data, setData] = useState<ItemDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [currency] = useState<"CNY" | "USD" | "COP">("CNY");

  useEffect(() => {
    if (!itemId) {
      setError("ID de producto no válido");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const otApi = new OtApiService();
    otApi
      .getItemDetail(
        OTAPI_CONFIG.INSTANCE_KEY,
        itemId,
        OTAPI_CONFIG.DEFAULT_LANGUAGE
      )
      .then((res) => {
        setData(res ?? null);
        if (!res) setError("Producto no encontrado");
      })
      .catch((err) => {
        setError(err?.message ?? "Error al cargar el producto");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [itemId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="animate-pulse flex gap-8">
            <div className="w-[480px] h-[480px] bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="flex-1 space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || "Producto no encontrado"}</p>
          <Link
            href="/dashboard"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const { item, pictures, configurations } = data;
  const mainImage = pictures[carouselIndex] || item.ImageUrl || PLACEHOLDER_IMAGE;
  const hasMultipleImages = pictures.length > 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb / Back */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Link
            href="/dashboard"
            className="hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
          >
            ← Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white truncate max-w-[200px]" title={item.Title}>
            {item.Title?.slice(0, 40)}…
          </span>
        </nav>

        {/* Main content: Taobao-style layout */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-8 p-6 lg:p-8">
            {/* Left: Image carousel */}
            <div className="flex-shrink-0 w-full lg:w-[480px]">
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden">
                <img
                  src={mainImage}
                  alt={item.Title || "Producto"}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      aria-label="Imagen anterior"
                      onClick={() =>
                        setCarouselIndex((i) =>
                          i === 0 ? pictures.length - 1 : i - 1
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Siguiente imagen"
                      onClick={() =>
                        setCarouselIndex((i) =>
                          i === pictures.length - 1 ? 0 : i + 1
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                    >
                      ›
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 rounded-full px-2 py-1.5">
                      {pictures.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Imagen ${i + 1}`}
                          onClick={() => setCarouselIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === carouselIndex
                              ? "bg-orange-500"
                              : "bg-white/60 hover:bg-white/80"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {hasMultipleImages && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                  {pictures.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCarouselIndex(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === carouselIndex
                          ? "border-orange-500"
                          : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-4 leading-snug">
                {item.Title || "Sin título"}
              </h1>

              <div className="flex flex-wrap items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-orange-500">
                  {formatPrice(item, currency)}
                </span>
                {item.OriginalPrice != null &&
                  item.OriginalPrice > item.PriceRMB && (
                    <span className="text-lg text-gray-500 dark:text-gray-400 line-through">
                      ¥{item.OriginalPrice.toLocaleString("es", { minimumFractionDigits: 2 })}
                    </span>
                  )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                {typeof item.SalesCount === "number" && (
                  <span>
                    <strong className="text-gray-900 dark:text-white">Vendidos:</strong>{" "}
                    {item.SalesCount.toLocaleString("es")}
                  </span>
                )}
                {item.Rating != null && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-500">⭐</span>
                    <strong className="text-gray-900 dark:text-white">{Number(item.Rating).toFixed(1)}</strong>
                    /5
                    {item.ReviewCount != null && item.ReviewCount > 0 && (
                      <span className="text-gray-500">({item.ReviewCount.toLocaleString("es")} reseñas)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Variantes / SKU */}
              {configurations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Opciones / Variantes
                  </h3>
                  <div className="flex flex-col gap-3">
                    {configurations.slice(0, 20).map((cfg) => (
                      <VariantCard key={cfg.Id} configuration={cfg} />
                    ))}
                    {configurations.length > 20 && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        +{configurations.length - 20} más variantes
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Tienda / Marca */}
              {(item.ShopName || item.BrandName) && (
                <div className="flex flex-wrap gap-4 text-sm mb-6">
                  {item.BrandName && (
                    <span>
                      <strong className="text-gray-700 dark:text-gray-300">Marca:</strong>{" "}
                      {item.BrandName}
                    </span>
                  )}
                  {item.ShopName && (
                    <span>
                      <strong className="text-gray-700 dark:text-gray-300">Tienda:</strong>{" "}
                      {item.ShopName}
                    </span>
                  )}
                </div>
              )}

              {/* Especificaciones (peso, dimensiones) */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6 mt-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Especificaciones
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                  {item.IsConfigurable != null && (
                    <li>
                      Tipo: <span className="font-medium text-gray-800 dark:text-gray-200">{item.IsConfigurable ? "Configurable (variantes/SKUs)" : "Simple"}</span>
                    </li>
                  )}
                  {item.Weight != null && (
                    <li>⚖️ Peso: {item.Weight} {item.WeightUnit ?? "kg"}</li>
                  )}
                  {item.VolumetricWeightKg != null && (
                    <li>📦 Peso volumétrico: {item.VolumetricWeightKg.toFixed(2)} kg</li>
                  )}
                  {(item.Length != null || item.Width != null || item.Height != null) && (
                    <li>
                      📐 Medidas: {[item.Length, item.Width, item.Height].filter(Boolean).join(" × ")}{" "}
                      {item.DimensionsUnit ?? "cm"}
                    </li>
                  )}
                  {item.SellerRating != null && (
                    <li>🏬 Valoración tienda: {Number(item.SellerRating).toFixed(1)}/5</li>
                  )}
                  {item.VariantCount != null && item.VariantCount > 0 && (
                    <li>📦 Variantes: {item.VariantCount}</li>
                  )}
                  <li className="font-mono text-gray-500">Taobao ID: {item.ItemId}</li>
                </ul>
              </div>

              {/* CTA */}
              <div className="flex flex-wrap gap-3 mt-8">
                {item.ItemUrl ? (
                  <a
                    href={item.ItemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    Comprar en Taobao →
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center px-8 py-4 bg-gray-400 text-white font-semibold rounded-xl cursor-not-allowed">
                    URL no disponible
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center justify-center px-6 py-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

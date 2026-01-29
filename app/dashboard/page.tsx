"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { OtApiService } from "@/lib/api/otapi";
import { OTAPI_CONFIG } from "@/lib/api/config";
import { OtapiItem, OtapiCategory } from "@/types/product";

export default function DashboardPage() {
  const router = useRouter();
  const [products, setProducts] = useState<OtapiItem[]>([]);
  const [categories, setCategories] = useState<OtapiCategory[]>([]);
  const [subcategories, setSubcategories] = useState<OtapiCategory[]>([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [sortType, setSortType] = useState("Ranksales");
  const [currency, setCurrency] = useState<"CNY" | "USD" | "COP">("CNY");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(),
  );

  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState("");
  const [environment, setEnvironment] = useState("");
  const [pageSize, setPageSize] = useState(20);

  // Filtrar categorías por búsqueda
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const searchLower = categorySearch.toLowerCase().trim();
    return categories.filter((cat) =>
      cat.Name.toLowerCase().includes(searchLower),
    );
  }, [categories, categorySearch]);

  // Filtrar subcategorías por búsqueda
  const filteredSubcategories = useMemo(() => {
    if (!subcategorySearch.trim()) return subcategories;
    const searchLower = subcategorySearch.toLowerCase().trim();
    return subcategories.filter((cat) =>
      cat.Name.toLowerCase().includes(searchLower),
    );
  }, [subcategories, subcategorySearch]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const env = localStorage.getItem("environment");
    const savedCurrency = localStorage.getItem("currency") as
      | "CNY"
      | "USD"
      | "COP"
      | null;

    if (!token) {
      router.push("/");
      return;
    }

    setEnvironment(env || "");
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
    fetchCategories();
  }, [router]);

  // Save currency preference to localStorage
  useEffect(() => {
    localStorage.setItem("currency", currency);
  }, [currency]);

  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory("");
    }
  }, [selectedCategory]);

  // Hacer nueva petición cuando cambie el sortType (solo si ya hay productos)
  useEffect(() => {
    if (selectedCategory && products.length > 0) {
      fetchProducts();
    }
  }, [sortType]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const otApiService = new OtApiService();
      const response = await otApiService.getCategories(
        OTAPI_CONFIG.INSTANCE_KEY,
        OTAPI_CONFIG.DEFAULT_LANGUAGE,
      );

      if (response.ErrorCode !== 0 && response.ErrorCode !== "Ok") {
        console.warn("Failed to fetch categories:", response.ErrorDescription);
        return;
      }

      setCategories(response.Content || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchSubcategories = async (parentCategoryId: string) => {
    try {
      const otApiService = new OtApiService();
      const response = await otApiService.getSubcategories(
        OTAPI_CONFIG.INSTANCE_KEY,
        parentCategoryId,
        OTAPI_CONFIG.DEFAULT_LANGUAGE,
      );

      if (response.ErrorCode !== 0 && response.ErrorCode !== "Ok") {
        console.warn(
          "Failed to fetch subcategories:",
          response.ErrorDescription,
        );
        setSubcategories([]);
        return;
      }

      setSubcategories(response.Content || []);
    } catch (err) {
      console.error("Error fetching subcategories:", err);
      setSubcategories([]);
    }
  };

  const fetchProducts = async () => {
    const categoryId = selectedSubcategory || selectedCategory;

    if (!categoryId) {
      setError("Por favor selecciona una categoría");
      return;
    }

    setLoading(true);
    setError("");
    setSelectedProducts(new Set()); // Limpia la selección al recargar productos

    try {
      const otApiService = new OtApiService();
      const response = await otApiService.getBestSellingProducts({
        instanceKey: OTAPI_CONFIG.INSTANCE_KEY,
        categoryId: categoryId,
        language: OTAPI_CONFIG.DEFAULT_LANGUAGE,
        frameSize: pageSize,
        framePosition: 0,
        sortType: sortType, // Enviar sortType al backend
      });

      if (response.ErrorCode !== 0 && response.ErrorCode !== "Ok") {
        throw new Error(
          response.ErrorDescription || "Error al cargar productos",
        );
      }

      setProducts(response.Content || []);
      if (!response.Content || response.Content.length === 0) {
        setError("No se encontraron productos en esta categoría");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar productos",
      );
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("environment");
    router.push("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const getSortLabel = (sort: string) => {
    switch (sort) {
      case "Ranksales":
        return "Más Vendidos";
      case "Rankprice_asc":
        return "Precio: Menor a Mayor";
      case "Rankprice_desc":
        return "Precio: Mayor a Menor";
      case "Ranknew":
        return "Más Recientes";
      default:
        return "Más Vendidos";
    }
  };

  const formatPrice = (product: OtapiItem) => {
    switch (currency) {
      case "CNY":
        return `¥${product.PriceRMB.toFixed(2)}`;
      case "USD":
        return `$${product.PriceUSD.toFixed(2)}`;
      case "COP":
        return `COP$${Math.round(product.PriceCOP).toLocaleString()}`;
      default:
        return `¥${product.PriceRMB.toFixed(2)}`;
    }
  };

  const getCurrencyLabel = (curr: string) => {
    switch (curr) {
      case "CNY":
        return "🇨🇳 Yuan (¥)";
      case "USD":
        return "🇺🇸 Dólar ($)";
      case "COP":
        return "🇨🇴 Peso (COP$)";
      default:
        return "🇨🇳 Yuan (¥)";
    }
  };

  // Selección de productos
  const handleSelectProduct = (id: string) => {
    setSelectedProducts((prev) => {
      const updated = new Set(prev);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedProducts.size === products.length)
      setSelectedProducts(new Set());
    else setSelectedProducts(new Set(products.map((p) => p.ItemId)));
  };

  // Exporta URLs seleccionadas (o todas si no hay selección)
  const exportToCSV = () => {
    const selected =
      selectedProducts.size === 0
        ? products // Si nada seleccionado, TODOS
        : products.filter((p) => selectedProducts.has(p.ItemId));

    const csvRows = [["Taobao URL"], ...selected.map((p) => [p.ItemUrl])];
    const csvContent = csvRows.map((row) => row.join(",")).join("\n");

    // Descarga el archivo
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "taobao-urls.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Taobao Importer
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {environment}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Explorar Productos por Categoría
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selecciona una categoría para ver los productos más vendidos
              </p>
            </div>

            {loadingCategories ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Cargando categorías...
                </p>
              </div>
            ) : (
              <>
                {/* Categories with Search */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Main Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Categoría Principal *
                    </label>

                    {/* Search Input */}
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Buscar categoría..."
                        className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        disabled={loading}
                      />
                      <svg
                        className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    {/* Category Dropdown */}
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedSubcategory("");
                        setCategorySearch("");
                      }}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      disabled={loading}
                      required
                      size={5}
                    >
                      <option value="">Selecciona una categoría</option>
                      {filteredCategories.map((cat) => (
                        <option key={cat.CategoryId} value={cat.CategoryId}>
                          {cat.Name}
                        </option>
                      ))}
                    </select>

                    {categorySearch && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Mostrando {filteredCategories.length} de{" "}
                        {categories.length} categorías
                      </p>
                    )}
                  </div>

                  {/* Subcategory */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subcategoría (Opcional)
                    </label>

                    {/* Search Input */}
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={subcategorySearch}
                        onChange={(e) => setSubcategorySearch(e.target.value)}
                        placeholder="Buscar subcategoría..."
                        className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        disabled={
                          loading ||
                          !selectedCategory ||
                          subcategories.length === 0
                        }
                      />
                      <svg
                        className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    {/* Subcategory Dropdown */}
                    <select
                      value={selectedSubcategory}
                      onChange={(e) => {
                        setSelectedSubcategory(e.target.value);
                        setSubcategorySearch("");
                      }}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      disabled={
                        loading ||
                        !selectedCategory ||
                        subcategories.length === 0
                      }
                      size={5}
                    >
                      <option value="">Todas las subcategorías</option>
                      {filteredSubcategories.map((cat) => (
                        <option key={cat.CategoryId} value={cat.CategoryId}>
                          {cat.Name}
                        </option>
                      ))}
                    </select>

                    {subcategorySearch && subcategories.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Mostrando {filteredSubcategories.length} de{" "}
                        {subcategories.length} subcategorías
                      </p>
                    )}
                  </div>
                </div>

                {/* Sort, Page Size, and Currency */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ordenar Por
                    </label>
                    <select
                      value={sortType}
                      onChange={(e) => setSortType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      disabled={loading}
                    >
                      <option value="Ranksales">🔥 Más Vendidos</option>
                      <option value="Rankprice_asc">
                        💰 Precio: Menor a Mayor
                      </option>
                      <option value="Rankprice_desc">
                        💎 Precio: Mayor a Menor
                      </option>
                      <option value="Ranknew">✨ Más Recientes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cantidad de Productos
                    </label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(parseInt(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      disabled={loading}
                    >
                      <option value={10}>10 productos</option>
                      <option value={20}>20 productos</option>
                      <option value={40}>40 productos</option>
                      <option value={60}>60 productos</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      💱 Moneda
                    </label>
                    <select
                      value={currency}
                      onChange={(e) =>
                        setCurrency(e.target.value as "CNY" | "USD" | "COP")
                      }
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      disabled={loading}
                    >
                      <option value="CNY">{getCurrencyLabel("CNY")}</option>
                      <option value="USD">{getCurrencyLabel("USD")}</option>
                      <option value="COP">{getCurrencyLabel("COP")}</option>
                    </select>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !selectedCategory}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-lg shadow-lg"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Cargando Productos...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      Cargar Productos {getSortLabel(sortType)}
                    </>
                  )}
                </button>
              </>
            )}
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Cargando productos {getSortLabel(sortType).toLowerCase()}...
            </p>
          </div>
        )}

        {/* Export controls y selección global */}
        {!loading && products.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-6 justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={
                  selectedProducts.size === products.length &&
                  products.length > 0
                }
                onChange={handleToggleSelectAll}
                className="form-checkbox h-5 w-5 text-blue-600"
                id="select-all-checkbox"
              />
              <label
                htmlFor="select-all-checkbox"
                className="font-medium cursor-pointer text-gray-700 dark:text-gray-300"
              >
                Seleccionar todos ({selectedProducts.size}/{products.length})
              </label>
            </div>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              onClick={exportToCSV}
              disabled={products.length === 0}
              type="button"
            >
              {selectedProducts.size === 0 ||
              selectedProducts.size === products.length
                ? "Exportar todos a CSV"
                : `Exportar (${selectedProducts.size}) a CSV`}
            </button>
          </div>
        )}
        {/* Products Grid */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product, index) => {
              const isSelected = selectedProducts.has(product.ItemId);
              return (
                <button
                  key={`${product.ItemId}-${index}`}
                  type="button"
                  onClick={() => handleSelectProduct(product.ItemId)}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105 relative cursor-pointer ${
                    isSelected ? "shadow-lg shadow-blue-400/60" : ""
                  }`}
                  style={{ textAlign: "inherit" }} // Para evitar select azul de botón en algunos navegadores
                >
                  {/* Selector */}
                  <input
                    type="checkbox"
                    className="absolute top-3 left-3 h-5 w-5 text-blue-600 z-10 pointer-events-none"
                    checked={isSelected}
                    tabIndex={-1}
                    readOnly
                  />
                  {/* Product Image */}
                  <div className="relative h-64 bg-gray-200 dark:bg-gray-700">
                    {product.ImageUrl ? (
                      <img
                        src={product.ImageUrl}
                        alt={product.Title || "Producto"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/300x300?text=Sin+Imagen";
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <svg
                          className="w-16 h-16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    {product.OriginalPrice &&
                      product.OriginalPrice > product.Price && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                          OFERTA
                        </div>
                      )}
                    {sortType === "Ranksales" && index < 3 && (
                      <div className="absolute top-2 left-9 bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                        <span>🔥</span>#{index + 1} Más Vendido
                      </div>
                    )}
                  </div>
                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-3 h-10 leading-5">
                      {product.Title || "Producto sin título"}
                    </h3>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatPrice(product)}
                      </span>
                      {product.OriginalPrice &&
                        typeof product.OriginalPrice === "number" &&
                        product.OriginalPrice > product.Price && (
                          <span className="text-sm text-gray-500 line-through">
                            ¥{product.OriginalPrice.toFixed(2)}
                          </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {product.Rating && typeof product.Rating === "number" && (
                        <div className="flex items-center gap-1">
                          <svg
                            className="w-4 h-4 text-yellow-400 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                          <span className="font-medium">
                            {product.Rating.toFixed(1)}
                          </span>
                        </div>
                      )}
                      <span className="text-xs font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                        {typeof product.SalesCount === "number"
                          ? product.SalesCount
                          : 0}{" "}
                        vendidos
                      </span>
                    </div>
                    {product.ShopName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                        🏪 {product.ShopName}
                      </p>
                    )}
                    {product.PublishDate && sortType === "Ranknew" && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mb-3 truncate">
                        📅 Publicado:{" "}
                        {new Date(product.PublishDate).toLocaleDateString(
                          "es-ES",
                        )}
                      </p>
                    )}
                    {product.ItemUrl ? (
                      <a
                        href={product.ItemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium text-sm shadow-md hover:shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver en Taobao →
                      </a>
                    ) : (
                      <div className="block w-full text-center px-4 py-2.5 bg-gray-400 text-white rounded-lg font-medium text-sm cursor-not-allowed">
                        URL no disponible
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && !loadingCategories && products.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Selecciona una categoría para comenzar
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Elige una categoría del menú superior para explorar los productos
              más vendidos de Taobao
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

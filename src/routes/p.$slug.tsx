import { createFileRoute, Link } from "@tanstack/react-router";
import { PortfolioLanding } from "@/components/PortfolioLanding";
import { getPublicPortfolio } from "@/lib/portfolio-generate.functions";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const slug = (params as { slug: string }).slug;
    const portfolio = await getPublicPortfolio({ data: { slug } });
    return { portfolio };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.portfolio
      ? [{ title: `${loaderData.portfolio.title}` }]
      : [{ title: "Portfolio" }],
  }),
  component: PublicPortfolioPage,
});

function PublicPortfolioPage() {
  const { portfolio } = Route.useLoaderData();

  if (!portfolio) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold text-foreground">Portfolio not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This portfolio may have been unpublished or the link is incorrect.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return <PortfolioLanding data={portfolio.data} />;
}

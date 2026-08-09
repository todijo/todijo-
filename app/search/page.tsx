import Home from "../page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <Home searchParams={Promise.resolve({ ...params, __resultsOnly: "1" })} />;
}

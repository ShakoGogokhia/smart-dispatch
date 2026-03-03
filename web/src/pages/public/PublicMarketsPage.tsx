// src/pages/public/PublicMarketsPage.tsx

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Market = {
  id: number;
  name: string;
  address?: string | null;
  is_active: boolean;
};

export default function PublicMarketsPage() {
  const q = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () =>
      (await api.get("/api/public/markets")).data as Market[],
  });

  const markets = q.data ?? [];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Available Markets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {markets.map((m) => (
                <Card key={m.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {m.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <div className="text-sm text-muted-foreground">
                      {m.address}
                    </div>
                    <Button asChild>
                      <Link to={`/m/${m.id}`}>Open Market</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
};

export default function MyMarketsPage() {
  const q = useQuery({
    queryKey: ["my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as Market[],
  });

  const markets = q.data ?? [];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>My Markets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : q.error ? (
            <div className="text-sm text-red-600">Failed to load markets</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markets.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.id}</TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.code}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="secondary">
                            <Link to={`/markets/${m.id}/items`}>Items</Link>
                          </Button>
                          <Button asChild variant="secondary">
                            <Link to={`/markets/${m.id}/promo-codes`}>Promo Codes</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {markets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        No markets assigned.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
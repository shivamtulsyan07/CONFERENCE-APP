import { useEffect, useState } from "react";
import { api, errMsg, money } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useRole } from "../context/RoleContext";

const empty = { name: "", sku: "", unit: "pcs", rate: "", shop_stock: "", low_stock_at: "10" };

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const { isAdmin } = useRole();

  const load = () => api.products().then(setRows).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Product name is required");
    try {
      await api.createProduct({
        ...form,
        rate: Number(form.rate) || 0,
        shop_stock: Number(form.shop_stock) || 0,
        low_stock_at: Number(form.low_stock_at) || 0,
      });
      toast.success("Product added");
      setForm(empty); setOpen(false); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const adjust = async (id, delta) => {
    try { await api.adjustStock(id, { delta }); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader
        testId="inventory-page"
        title="Shop Stock"
        subtitle="Stock received from the company and available for dispatch"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="add-product-btn">Add product</Button></DialogTrigger>
            <DialogContent data-testid="product-dialog">
              <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["name", "Product name"], ["sku", "SKU"], ["unit", "Unit"],
                  ["rate", "Rate"], ["shop_stock", "Opening stock"], ["low_stock_at", "Low stock alert at"],
                ].map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={k}>{label}</Label>
                    <Input id={k} data-testid={`product-${k}-input`} value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <DialogFooter><Button data-testid="save-product-btn" onClick={save}>Save product</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid-panel overflow-x-auto" data-testid="inventory-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Shop stock</TableHead>
              <TableHead className="text-right">Adjust</TableHead>
              {isAdmin && <TableHead className="text-right">Delete</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-muted-foreground">No products yet.</TableCell></TableRow>
            )}
            {rows.map((p) => (
              <TableRow key={p.id} className="row-hover" data-testid={`product-row-${p.id}`}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="mono text-xs">{p.sku || "—"}</TableCell>
                <TableCell className="text-right mono">{money(p.rate)}</TableCell>
                <TableCell className="text-right">
                  <span
                    data-testid={`stock-value-${p.id}`}
                    className={`mono font-semibold ${p.shop_stock <= p.low_stock_at ? "text-destructive" : ""}`}
                  >
                    {p.shop_stock} {p.unit}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="outline" size="icon" data-testid={`stock-minus-${p.id}`} onClick={() => adjust(p.id, -1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" data-testid={`stock-plus-${p.id}`} onClick={() => adjust(p.id, 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" data-testid={`delete-product-${p.id}`}
                      onClick={async () => { await api.deleteProduct(p.id); toast.success("Deleted"); load(); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

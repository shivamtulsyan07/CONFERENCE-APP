import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useRole } from "../context/RoleContext";

const empty = { name: "", page: "", phone: "", city: "" };

export default function Parties() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const { isAdmin } = useRole();

  const load = () => api.parties().then(setRows).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Party name is required");
    try {
      await api.createParty(form);
      toast.success("Party added");
      setForm(empty); setOpen(false); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader
        testId="parties-page"
        title="Party Master"
        subtitle="Names and page numbers used by the Conference Order dropdowns"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="add-party-btn">ADD PARTY</Button></DialogTrigger>
            <DialogContent data-testid="party-dialog">
              <DialogHeader><DialogTitle>New party</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {[["name", "Party name"], ["page", "Page"], ["phone", "Phone"], ["city", "City"]].map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={k}>{label}</Label>
                    <Input id={k} data-testid={`party-${k}-input`} value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <DialogFooter><Button data-testid="save-party-btn" onClick={save}>SAVE PARTY</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid-panel overflow-x-auto" data-testid="parties-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party name</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              {isAdmin && <TableHead className="text-right">Delete</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">No parties yet.</TableCell></TableRow>
            )}
            {rows.map((p) => (
              <TableRow key={p.id} className="row-hover" data-testid={`party-row-${p.id}`}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="mono">{p.page || "—"}</TableCell>
                <TableCell className="mono">{p.phone || "—"}</TableCell>
                <TableCell>{p.city || "—"}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" data-testid={`delete-party-${p.id}`}
                      onClick={async () => { await api.deleteParty(p.id); toast.success("Removed"); load(); }}>
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

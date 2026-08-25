"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  _count?: { createdDocuments: number };
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user);

  const { data: users = [], isLoading } = useQuery<UserInfo[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserInfo[]>("/api/users"),
  });

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "editor" });

  const openNewUser = () => {
    setEditingUser(null);
    setUserForm({ name: "", email: "", password: "", role: "editor" });
    setUserDialogOpen(true);
  };

  const openEditUser = (u: UserInfo) => {
    setEditingUser(u);
    setUserForm({ name: u.name || "", email: u.email, password: "", role: u.role });
    setUserDialogOpen(true);
  };

  const userSaveMutation = useMutation({
    mutationFn: async (form: typeof userForm) => {
      if (editingUser) {
        return apiFetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingUser.id, ...form }),
        });
      }
      return apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setUserDialogOpen(false);
      toast.success(editingUser ? "User updated" : "User created");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save user"),
  });

  const userDeleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/users?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete user"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <CardTitle className="text-base">User Management</CardTitle>
        </div>
        <Button size="sm" onClick={openNewUser} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> New User
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-center font-medium">Role</th>
                    <th className="px-3 py-2 text-center font-medium">Docs</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">{u.name || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.role === "admin" && <Shield className="h-3 w-3" />}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {u._count?.createdDocuments || 0}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditUser(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {u.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => userDeleteMutation.mutate(u.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@company.com"
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(v) => setUserForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - full access</SelectItem>
                  <SelectItem value="editor">Editor - own documents</SelectItem>
                  <SelectItem value="viewer">Viewer - read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? "New Password (leave blank to keep current)" : "Password"}</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editingUser ? "Leave blank to keep current" : "Min. 6 characters"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => userSaveMutation.mutate(userForm)}
              disabled={
                userSaveMutation.isPending ||
                (!editingUser && (!userForm.email || !userForm.password))
              }
            >
              {userSaveMutation.isPending ? "Saving..." : editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

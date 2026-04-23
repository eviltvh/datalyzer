import os
import csv
from tkinter import filedialog, messagebox, ttk
import customtkinter as ctk

from polpo_backend import (
    AUTH_FILE,
    verify_credentials,
    parse_stats_csv,
    parse_self_history,
    QUERIES,
)

BG_DEEP = "#0A0A0A"
BG_CARD = "#FAFAF9"
BG_CARD_DARK = "#111111"
TEXT_WHITE = "#FAFAF9"
TEXT_BLACK = "#000000"
TEXT_MUTED = "#737373"
ACCENT_NEON = "#E8FF00"
ACCENT_PINK = "#FF3366"
ACCENT_BLUE = "#00D9FF"

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")


class LoginWindow(ctk.CTk):
    def __init__(self, on_success):
        super().__init__()
        self.on_success = on_success
        self.title("POLPO // LOGIN")
        self.geometry("460x520")
        self.resizable(False, False)
        self.configure(fg_color=BG_DEEP)

        header = ctk.CTkFrame(self, fg_color=BG_DEEP, height=90)
        header.pack(fill="x", padx=0, pady=0)
        ctk.CTkLabel(
            header, text="POLPO // ANALYTICS",
            font=("JetBrains Mono", 22, "bold"),
            text_color=TEXT_WHITE,
        ).pack(pady=(30, 2))
        ctk.CTkLabel(
            header, text="[ desktop edition ] → -bynd",
            font=("JetBrains Mono", 10),
            text_color=ACCENT_NEON,
        ).pack()

        sep = ctk.CTkFrame(self, fg_color=ACCENT_NEON, height=3)
        sep.pack(fill="x", padx=0, pady=(10, 0))

        card = ctk.CTkFrame(self, fg_color=BG_CARD, corner_radius=0, border_width=3, border_color=TEXT_BLACK)
        card.pack(padx=30, pady=30, fill="both", expand=True)

        ctk.CTkLabel(
            card, text="ACCESO REQUERIDO",
            font=("JetBrains Mono", 11, "bold"),
            text_color=TEXT_BLACK,
        ).pack(pady=(25, 20))

        ctk.CTkLabel(
            card, text="USUARIO",
            font=("JetBrains Mono", 9, "bold"),
            text_color=TEXT_MUTED,
        ).pack(anchor="w", padx=40)
        self.user_entry = ctk.CTkEntry(
            card, width=340, height=38,
            fg_color="white", text_color=TEXT_BLACK,
            border_color=TEXT_BLACK, border_width=2, corner_radius=0,
            font=("JetBrains Mono", 12),
        )
        self.user_entry.pack(padx=40, pady=(4, 14))

        ctk.CTkLabel(
            card, text="CONTRASEÑA",
            font=("JetBrains Mono", 9, "bold"),
            text_color=TEXT_MUTED,
        ).pack(anchor="w", padx=40)
        self.pass_entry = ctk.CTkEntry(
            card, width=340, height=38, show="•",
            fg_color="white", text_color=TEXT_BLACK,
            border_color=TEXT_BLACK, border_width=2, corner_radius=0,
            font=("JetBrains Mono", 12),
        )
        self.pass_entry.pack(padx=40, pady=(4, 18))
        self.pass_entry.bind("<Return>", lambda e: self.try_login())

        self.login_btn = ctk.CTkButton(
            card, text="→ ENTRAR",
            width=340, height=42,
            fg_color=ACCENT_NEON, hover_color="#B8CC00",
            text_color=TEXT_BLACK, corner_radius=0,
            border_width=2, border_color=TEXT_BLACK,
            font=("JetBrains Mono", 13, "bold"),
            command=self.try_login,
        )
        self.login_btn.pack(padx=40, pady=(0, 8))

        self.status = ctk.CTkLabel(
            card, text="",
            font=("JetBrains Mono", 10),
            text_color=ACCENT_PINK,
        )
        self.status.pack(pady=(6, 0))

        ctk.CTkLabel(
            card, text=f"auth: {AUTH_FILE.name}",
            font=("JetBrains Mono", 8),
            text_color=TEXT_MUTED,
        ).pack(side="bottom", pady=12)

        self.user_entry.focus()

    def try_login(self):
        u = self.user_entry.get().strip()
        p = self.pass_entry.get()
        if not u or not p:
            self.status.configure(text="✗ faltan campos")
            return
        if verify_credentials(u, p):
            self.status.configure(text="✓ acceso concedido", text_color=ACCENT_NEON)
            self.update()
            self.after(300, self._launch)
        else:
            self.status.configure(text="✗ credenciales inválidas", text_color=ACCENT_PINK)
            self.pass_entry.delete(0, "end")

    def _launch(self):
        self.destroy()
        self.on_success()


class ResultsWindow(ctk.CTkToplevel):
    def __init__(self, parent, title, rows, columns):
        super().__init__(parent)
        self.title(f"POLPO // {title}")
        self.geometry("1100x650")
        self.configure(fg_color=BG_DEEP)

        head = ctk.CTkFrame(self, fg_color=BG_DEEP, height=70)
        head.pack(fill="x")
        ctk.CTkLabel(
            head, text=title,
            font=("JetBrains Mono", 14, "bold"),
            text_color=TEXT_WHITE,
        ).pack(anchor="w", padx=24, pady=(18, 2))
        ctk.CTkLabel(
            head, text=f"[ {len(rows)} filas · {len(columns)} columnas ]",
            font=("JetBrains Mono", 9),
            text_color=ACCENT_NEON,
        ).pack(anchor="w", padx=24)

        ctk.CTkFrame(self, fg_color=ACCENT_NEON, height=3).pack(fill="x")

        table_wrap = ctk.CTkFrame(self, fg_color=BG_DEEP)
        table_wrap.pack(fill="both", expand=True, padx=16, pady=16)

        style = ttk.Style()
        style.theme_use("default")
        style.configure(
            "Polpo.Treeview",
            background=BG_CARD,
            foreground=TEXT_BLACK,
            rowheight=28,
            fieldbackground=BG_CARD,
            borderwidth=0,
            font=("JetBrains Mono", 10),
        )
        style.configure(
            "Polpo.Treeview.Heading",
            background=TEXT_BLACK,
            foreground=ACCENT_NEON,
            font=("JetBrains Mono", 10, "bold"),
            borderwidth=1,
            relief="flat",
        )
        style.map("Polpo.Treeview",
                  background=[("selected", ACCENT_NEON)],
                  foreground=[("selected", TEXT_BLACK)])
        style.map("Polpo.Treeview.Heading",
                  background=[("active", ACCENT_NEON)],
                  foreground=[("active", TEXT_BLACK)])

        tree_container = ctk.CTkFrame(table_wrap, fg_color=TEXT_BLACK, corner_radius=0)
        tree_container.pack(fill="both", expand=True)

        y_scroll = ttk.Scrollbar(tree_container, orient="vertical")
        x_scroll = ttk.Scrollbar(tree_container, orient="horizontal")
        tree = ttk.Treeview(
            tree_container, columns=columns, show="headings",
            yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set,
            style="Polpo.Treeview",
        )
        y_scroll.config(command=tree.yview)
        x_scroll.config(command=tree.xview)
        y_scroll.pack(side="right", fill="y")
        x_scroll.pack(side="bottom", fill="x")
        tree.pack(fill="both", expand=True, padx=2, pady=2)

        for col in columns:
            tree.heading(col, text=col.upper(),
                         command=lambda c=col: self._sort(tree, c, False))
            tree.column(col, width=140, anchor="w", minwidth=80)

        tree.tag_configure("even", background="#FAFAF9")
        tree.tag_configure("odd", background="#F0F0EE")
        for i, row in enumerate(rows):
            values = [row.get(c, "") for c in columns]
            tag = "even" if i % 2 == 0 else "odd"
            tree.insert("", "end", values=values, tags=(tag,))

        footer = ctk.CTkFrame(self, fg_color=BG_DEEP, height=50)
        footer.pack(fill="x", padx=16, pady=(0, 12))

        self._rows = rows
        self._columns = columns
        self._title = title

        export_btn = ctk.CTkButton(
            footer, text="↓ EXPORTAR CSV",
            fg_color=ACCENT_BLUE, hover_color="#00AED4",
            text_color=TEXT_BLACK, corner_radius=0,
            border_width=2, border_color=TEXT_BLACK,
            font=("JetBrains Mono", 10, "bold"),
            width=160, height=32,
            command=self.export_csv,
        )
        export_btn.pack(side="right", padx=4)

        close_btn = ctk.CTkButton(
            footer, text="✗ CERRAR",
            fg_color=ACCENT_PINK, hover_color="#CC2952",
            text_color=TEXT_WHITE, corner_radius=0,
            border_width=2, border_color=TEXT_BLACK,
            font=("JetBrains Mono", 10, "bold"),
            width=120, height=32,
            command=self.destroy,
        )
        close_btn.pack(side="right", padx=4)

    def _sort(self, tree, col, reverse):
        data = [(tree.set(k, col), k) for k in tree.get_children("")]
        try:
            data.sort(key=lambda x: float(x[0]), reverse=reverse)
        except ValueError:
            data.sort(key=lambda x: x[0], reverse=reverse)
        for idx, (_, k) in enumerate(data):
            tree.move(k, "", idx)
            tree.item(k, tags=("even" if idx % 2 == 0 else "odd",))
        tree.heading(col, command=lambda: self._sort(tree, col, not reverse))

    def export_csv(self):
        path = filedialog.asksaveasfilename(
            parent=self,
            defaultextension=".csv",
            filetypes=[("CSV", "*.csv")],
            initialfile=f"{self._title.split(' · ')[0].lower()}.csv",
        )
        if not path:
            return
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=self._columns)
            w.writeheader()
            for r in self._rows:
                w.writerow({c: r.get(c, "") for c in self._columns})
        messagebox.showinfo("Exportado", f"→ guardado en {path}", parent=self)


class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("POLPO // ANALYTICS · DESKTOP")
        self.geometry("980x720")
        self.configure(fg_color=BG_DEEP)

        self.stats_data = None
        self.self_data = None

        header = ctk.CTkFrame(self, fg_color=BG_DEEP, height=90)
        header.pack(fill="x")
        left = ctk.CTkFrame(header, fg_color=BG_DEEP)
        left.pack(side="left", padx=28, pady=18)
        ctk.CTkLabel(
            left, text="POLPO // ANALYTICS",
            font=("JetBrains Mono", 22, "bold"),
            text_color=TEXT_WHITE,
        ).pack(anchor="w")
        ctk.CTkLabel(
            left, text="[ instagram growth intelligence · desktop ]",
            font=("JetBrains Mono", 9),
            text_color=TEXT_MUTED,
        ).pack(anchor="w", pady=(2, 0))

        badge = ctk.CTkLabel(
            header, text=" SNCTVM TOOLS ",
            font=("JetBrains Mono", 9, "bold"),
            fg_color=ACCENT_NEON, text_color=TEXT_BLACK,
            corner_radius=0,
        )
        badge.pack(side="right", padx=28, pady=28)

        ctk.CTkFrame(self, fg_color=ACCENT_NEON, height=3).pack(fill="x")

        load_frame = ctk.CTkFrame(self, fg_color=BG_DEEP)
        load_frame.pack(fill="x", padx=28, pady=(20, 10))

        ctk.CTkLabel(
            load_frame, text="[ DATA SOURCES ]",
            font=("JetBrains Mono", 9, "bold"),
            text_color=TEXT_MUTED,
        ).pack(anchor="w", pady=(0, 8))

        files_row = ctk.CTkFrame(load_frame, fg_color=BG_DEEP)
        files_row.pack(fill="x")

        stats_card = ctk.CTkFrame(
            files_row, fg_color=BG_CARD,
            border_width=3, border_color=TEXT_BLACK, corner_radius=0,
        )
        stats_card.pack(side="left", fill="both", expand=True, padx=(0, 10), ipady=12)
        ctk.CTkLabel(
            stats_card, text="stats.csv",
            font=("JetBrains Mono", 12, "bold"),
            text_color=TEXT_BLACK,
        ).pack(pady=(10, 2))
        self.stats_status = ctk.CTkLabel(
            stats_card, text="→ no cargado",
            font=("JetBrains Mono", 9),
            text_color=TEXT_MUTED,
        )
        self.stats_status.pack()
        ctk.CTkButton(
            stats_card, text="SELECCIONAR",
            fg_color=TEXT_BLACK, hover_color="#222222",
            text_color=ACCENT_NEON, corner_radius=0,
            border_width=2, border_color=TEXT_BLACK,
            font=("JetBrains Mono", 9, "bold"),
            height=32, width=200,
            command=self.load_stats,
        ).pack(pady=(8, 4))

        self_card = ctk.CTkFrame(
            files_row, fg_color=BG_CARD,
            border_width=3, border_color=TEXT_BLACK, corner_radius=0,
        )
        self_card.pack(side="left", fill="both", expand=True, padx=(10, 0), ipady=12)
        ctk.CTkLabel(
            self_card, text="self_history.csv",
            font=("JetBrains Mono", 12, "bold"),
            text_color=TEXT_BLACK,
        ).pack(pady=(10, 2))
        self.self_status = ctk.CTkLabel(
            self_card, text="→ opcional",
            font=("JetBrains Mono", 9),
            text_color=TEXT_MUTED,
        )
        self.self_status.pack()
        ctk.CTkButton(
            self_card, text="SELECCIONAR",
            fg_color=TEXT_BLACK, hover_color="#222222",
            text_color=ACCENT_BLUE, corner_radius=0,
            border_width=2, border_color=TEXT_BLACK,
            font=("JetBrains Mono", 9, "bold"),
            height=32, width=200,
            command=self.load_self,
        ).pack(pady=(8, 4))

        ctk.CTkLabel(
            self, text="[ CONSULTAS ]",
            font=("JetBrains Mono", 9, "bold"),
            text_color=TEXT_MUTED,
        ).pack(anchor="w", padx=28, pady=(18, 8))

        queries_scroll = ctk.CTkScrollableFrame(
            self, fg_color=BG_DEEP,
            scrollbar_button_color=ACCENT_NEON,
            scrollbar_button_hover_color="#B8CC00",
        )
        queries_scroll.pack(fill="both", expand=True, padx=28, pady=(0, 16))

        self.query_buttons = []
        for label, func, data_type in QUERIES:
            btn = ctk.CTkButton(
                queries_scroll, text=label,
                fg_color=BG_CARD, hover_color=ACCENT_NEON,
                text_color=TEXT_BLACK, corner_radius=0,
                border_width=2, border_color=TEXT_BLACK,
                font=("JetBrains Mono", 11),
                height=40, anchor="w",
                command=lambda f=func, l=label, d=data_type: self.run_query(f, l, d),
            )
            btn.pack(fill="x", pady=3)
            self.query_buttons.append(btn)

        self._refresh_button_states()

        ctk.CTkFrame(self, fg_color=ACCENT_NEON, height=2).pack(fill="x")
        footer = ctk.CTkFrame(self, fg_color=BG_DEEP, height=30)
        footer.pack(fill="x")
        ctk.CTkLabel(
            footer, text="POLPO desktop · -bynd · SNCTVM",
            font=("JetBrains Mono", 8),
            text_color=TEXT_MUTED,
        ).pack(pady=6)

    def load_stats(self):
        path = filedialog.askopenfilename(
            filetypes=[("CSV", "*.csv")],
            title="seleccionar stats.csv",
        )
        if not path:
            return
        try:
            self.stats_data = parse_stats_csv(path)
            self.stats_status.configure(
                text=f"✓ {len(self.stats_data)} filas · {os.path.basename(path)}",
                text_color=ACCENT_NEON,
            )
        except Exception as e:
            messagebox.showerror("Error", f"no se pudo parsear:\n{e}")
            self.stats_status.configure(text="✗ error al cargar", text_color=ACCENT_PINK)
        self._refresh_button_states()

    def load_self(self):
        path = filedialog.askopenfilename(
            filetypes=[("CSV", "*.csv")],
            title="seleccionar self_history.csv",
        )
        if not path:
            return
        try:
            self.self_data = parse_self_history(path)
            self.self_status.configure(
                text=f"✓ {len(self.self_data)} snapshots · {os.path.basename(path)}",
                text_color=ACCENT_BLUE,
            )
        except Exception as e:
            messagebox.showerror("Error", f"no se pudo parsear:\n{e}")
            self.self_status.configure(text="✗ error", text_color=ACCENT_PINK)
        self._refresh_button_states()

    def _refresh_button_states(self):
        for btn, (_, _, data_type) in zip(self.query_buttons, QUERIES):
            if data_type == "stats":
                ok = self.stats_data is not None
            else:
                ok = self.self_data is not None
            btn.configure(state="normal" if ok else "disabled")

    def run_query(self, func, title, data_type):
        try:
            if data_type == "stats":
                rows, cols = func(self.stats_data)
            else:
                rows, cols = func(self.self_data)
        except Exception as e:
            messagebox.showerror("Error en consulta", f"{title}\n\n{e}")
            return
        if not rows:
            messagebox.showinfo("Sin resultados", f"{title} no devolvió filas")
            return
        ResultsWindow(self, title, rows, cols)


def main():
    def launch_main():
        app = MainWindow()
        app.mainloop()

    login = LoginWindow(on_success=launch_main)
    login.mainloop()


if __name__ == "__main__":
    main()

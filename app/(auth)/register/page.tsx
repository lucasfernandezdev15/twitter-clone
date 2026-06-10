"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/lib/context/auth-context";
import { registerSchema } from "@/lib/validators";

type RegisterResponse = {
  token: string;
  user: AuthUser;
};

type FieldErrors = Partial<
  Record<"email" | "username" | "displayName" | "password", string>
>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = registerSchema.safeParse({
      email,
      username,
      displayName,
      password,
    });

    if (!parsed.success) {
      const errors: FieldErrors = {};
      const flattened = parsed.error.flatten().fieldErrors;

      for (const [key, messages] of Object.entries(flattened)) {
        if (messages?.[0]) {
          errors[key as keyof FieldErrors] = messages[0];
        }
      }

      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await apiFetch<RegisterResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });

      login(data.token, data.user);
      router.push("/home");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo crear la cuenta");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="rounded-2xl border border-zinc-800 bg-black p-6 shadow-xl sm:p-8">
      <h1 className="mb-6 text-2xl font-bold">Crear cuenta</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {(
          [
            {
              id: "email",
              label: "Email",
              type: "email",
              value: email,
              onChange: setEmail,
              autoComplete: "email",
              placeholder: "tu@email.com",
            },
            {
              id: "username",
              label: "Usuario",
              type: "text",
              value: username,
              onChange: setUsername,
              autoComplete: "username",
              placeholder: "juanperez",
            },
            {
              id: "displayName",
              label: "Nombre para mostrar",
              type: "text",
              value: displayName,
              onChange: setDisplayName,
              autoComplete: "name",
              placeholder: "Juan Pérez",
            },
            {
              id: "password",
              label: "Contraseña",
              type: "password",
              value: password,
              onChange: setPassword,
              autoComplete: "new-password",
              placeholder: "Mínimo 8 caracteres",
            },
          ] as const
        ).map((field) => (
          <div key={field.id}>
            <label
              htmlFor={field.id}
              className="mb-1.5 block text-sm text-zinc-400"
            >
              {field.label}
            </label>
            <input
              id={field.id}
              type={field.type}
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              autoComplete={field.autoComplete}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder={field.placeholder}
            />
            {fieldErrors[field.id as keyof FieldErrors] && (
              <p className="mt-1.5 text-sm text-red-400">
                {fieldErrors[field.id as keyof FieldErrors]}
              </p>
            )}
          </div>
        ))}

        {error && (
          <p className="rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-sky-500 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creando cuenta..." : "Registrarse"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-sky-500 hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </main>
  );
}

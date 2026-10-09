import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Повертаємо всі обов'язкові поля таблиці users зі schema.ts
      profile(params) {
        const email = params.email as string;
        const fullname = ((params.name ?? params.fullname) as string) ?? "";
        return {
          email,
          fullname,
          username: email.split("@")[0],
          image: "",
          followers: 0,
          following: 0,
          posts: 0,
        };
      },
    }),
  ],
});

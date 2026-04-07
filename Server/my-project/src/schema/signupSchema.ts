import { z } from "zod";

export const validateusername = z
    .string()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(30, { message: "Username must be at most 30 characters long" })
    .nonempty({ message: "Username is required" })



export const signupSchema = z.object({
    username: validateusername,
    email: z
        .string()
        .email({ message: "Invalid email address" }),
    password: z
        .string()
        .min(6, { message: "Password must be at least 6 characters long" })
})


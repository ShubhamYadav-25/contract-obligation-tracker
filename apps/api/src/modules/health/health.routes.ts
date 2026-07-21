import { Router } from "express";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({
      success: true,
      data: {
        status: "ok",
        service: "contract-obligation-tracker-api",
      },
    });
  });

  return router;
}

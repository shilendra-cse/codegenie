import { createApi } from "@/lib/ApiRouter";
import {
  createItem,
  getHealth,
  getItem,
  listItems,
} from "./example.controller";

const api = createApi();

api.get("/example/health").noAuth(getHealth);
api.get("/example/items").authSecure(listItems);
api.post("/example/items").authSecure(createItem);
api.get("/example/items/:itemId").authSecure(getItem);

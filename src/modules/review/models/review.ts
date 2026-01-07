import { model } from "@medusajs/framework/utils"

export const Review = model.define("review", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  customer_email: model.text().nullable(),
  customer_name: model.text(),
  rating: model.number(),
  comment: model.text().nullable(),
  status: model.enum(["pending", "approved", "rejected"]),
  approved_at: model.dateTime().nullable(),
  approved_by: model.text().nullable(),
  ip_address: model.text().nullable(),
})
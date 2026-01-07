import { model } from "@medusajs/framework/utils"

export const Category = model.define("category", {
    id: model.id().primaryKey(),
    name: model.text(),
    slug: model.text(),
})

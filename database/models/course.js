const {
  Schema,
  model,
  SchemaTypes: { ObjectId }
} = require("mongoose");

const CourseSchema = new Schema(
  {
    name: String,
    user: {
      type: ObjectId,
      ref: "user"
    },
    lessons: [
      {
        type: ObjectId,
        ref: "lesson"
      }
    ]
  },
  { timestamps: true }
);

CourseSchema.index({ user: 1, createdAt: -1 });
CourseSchema.index({ user: 1, name: 1 });

module.exports = model("course", CourseSchema);

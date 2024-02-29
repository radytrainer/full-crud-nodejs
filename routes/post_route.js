const express = require("express");
const router = express.Router();
const {
  getPosts,
  getPost,
  createPost,
  deletePost,
  updatePost,
} = require("../models/post_model");

/**
 * Get All posts from database
 * @route GET /api/posts
 */
router.get("/", (req, res) => {
  let posts = getPosts();
  res.json({ success: true, data: posts });
});

/**
 * Get a post from database
 * @route GET /api/posts/:id
 */
router.get("/:id", (req, res) => {
  let id = req.params.id;
  let post = getPost(id);
  res.json(post);
});

/**
 * Create a post in database
 * @route POST /api/posts
 */
router.post("/", (req, res) => {
  let post = req.body;
  let newpost = createPost(post);
  res.json(newpost);
});

/**
 * Delete a post from database
 * @route DELETE /api/posts/:id
 */
router.delete("/:id", (req, res) => {
  let id = req.params.id;
  let post = deletePost(id);
  res.json(post);
});

/**
 * Update a post in database
 * @route PUT /api/posts/:id
 */
router.put("/:id", (req, res) => {
    let id = req.params.id;
    let title = req.body.title;
    let description = req.body.description;
    let date = req.body.date;
    let post = updatePost(id,title, description, date);
    res.json(post);
});

module.exports = router;

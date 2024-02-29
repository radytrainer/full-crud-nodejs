const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  deleteUser,
  updateUser,
} = require("../models/user_model");

/**
 * Get All Users from database
 * @route GET /api/users
 */
router.get("/", (req, res) => {
  let users = getUsers();
  res.json({ success: true, data: users });
});

/**
 * Get a user from database
 * @route GET /api/users/:id
 */
router.get("/:id", (req, res) => {
  let id = req.params.id;
  let user = getUser(id);
  res.json(user);
});

/**
 * Create a user in database
 * @route POST /api/users
 */
router.post("/", (req, res) => {
  let user = req.body;
  let newUser = createUser(user);
  res.json(newUser);
});

/**
 * Delete a user from database
 * @route DELETE /api/users/:id
 */
router.delete("/:id", (req, res) => {
  let id = req.params.id;
  let user = deleteUser(id);
  res.json(user);
});

/**
 * Update a user in database
 * @route PUT /api/users/:id
 */
router.put("/:id", (req, res) => {
    let id = req.params.id;
    let name = req.body.name;
    let age = req.body.age;
    let status = req.body.status;
    let user = updateUser(id,name, age, status);
    res.json(user);
});

module.exports = router;

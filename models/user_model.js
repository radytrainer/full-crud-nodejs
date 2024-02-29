const { v4: uuidv4 } = require("uuid");

const { saveData, getData } = require("../utils/file_util");

let users = getData("./database/users.json");

/**
 * Get all users from database
 * @returns {Array JSON Object}
 */
function getUsers() {
  return users;
}

/**
 * Get single user from database by id
 * @param {int} id
 * @returns {Object}
 */
function getUser(id) {
  let user = users.find((user) => user.id === id);
  if (user !== undefined) {
    return { success: true, data: user };
  } else {
    return { success: false, message: "User not found" };
  }
}

/**
 * Create new user in database
 * @param {object} user
 * @returns {Object}
 */
function createUser(user) {
  user.id = uuidv4();
  users.push(user);
  saveData("./database/users.json", users);
  return { success: true, data: user, message: "User created successfully" };
}
/**
 * Remove user from database by id
 * @param {int} id
 * @returns {Object}
 */
function deleteUser(id) {
  let uid = users.findIndex((user) => user.id === id);
  if (uid !== 1) {
    users.splice(uid, 1);
    saveData("./database/users.json", users);
    return { success: true, message: "User deleted successfully" };
  } else {
    return { success: false, message: "User not found" };
  }
}
/**
 * Update user in database by id
 * @param {int} id
 * @param {string} name
 * @param {int} age
 * @param {string} status
 * @returns {Object}
 */
function updateUser(id, name, age, status) {
  let uid = users.findIndex((user) => user.id === id);
  console.log(uid);
  if (uid !== -1) {
    let user = users[uid];
    user.name = name;
    user.age = age;
    user.status = status;
    saveData("./database/users.json", users);
    return { success: true, message: "User updated successfully" };
  } else {
    return { success: false, message: "User not found" };
  }
}

module.exports = { getUsers, getUser, createUser, deleteUser, updateUser };

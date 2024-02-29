const { v4: uuidv4 } = require("uuid");

const { saveData, getData } = require("../utils/file_util");

let posts = getData("./database/posts.json");

/**
 * Get all posts from database
 * @returns {Array JSON Object}
 */
function getPosts() {
  return posts;
}

/**
 * Get single post from database by id
 * @param {int} id
 * @returns {Object}
 */
function getPost(id) {
  let post = posts.find((post) => post.id === id);
  if (post !== undefined) {
    return { success: true, data: post };
  } else {
    return { success: false, message: "Post not found" };
  }
}

/**
 * Create new post in database
 * @param {object} post
 * @returns {Object}
 */
function createPost(post) {
  post.id = uuidv4();
  posts.push(post);
  saveData("./database/posts.json", posts);
  return { success: true, data: post, message: "Post created successfully" };
}
/**
 * Remove post from database by id
 * @param {int} id
 * @returns {Object}
 */
function deletePost(id) {
  let uid = posts.findIndex((post) => post.id === id);
  if (uid !== 1) {
    posts.splice(uid, 1);
    saveData("./database/posts.json", posts);
    return { success: true, message: "Post deleted successfully" };
  } else {
    return { success: false, message: "Post not found" };
  }
}
/**
 * Update post in database by id
 * @param {int} id
 * @param {string} title
 * @param {string} description
 * @param {string} date
 * @returns {Object}
 */
function updatePost(id, title, description, date) {
  let uid = posts.findIndex((post) => post.id === id);
  console.log(uid);
  if (uid !== -1) {
    let post = posts[uid];
    post.title = title;
    post.description = description;
    post.date = date;
    saveData("./database/posts.json", posts);
    return { success: true, message: "post updated successfully" };
  } else {
    return { success: false, message: "post not found" };
  }
}

module.exports = { getPosts, getPost, createPost, deletePost, updatePost };

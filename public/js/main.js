
// User 
function displayUsers(response) {
    let users = response.data;
    let output = "";
    users.data.forEach(user => {
        output += `
        <tr>
            <td>${user.name}</td>
            <td>${user.age}</td>
            <td>${user.status}</td>
            <td>
                <button type="button" class="btn btn-warning btn-sm">Edit</button>
                <button type="button" class="btn btn-danger btn-sm">Delete</button>
            </td>
        </tr>
        `;
    });
    document.getElementById("users").innerHTML = output;
}

axios
.get('/api/users')
.then(displayUsers)
.catch( err => { console.log(err);});



// Post 
function displayPosts(response) {
    let posts = response.data;
    let output = "";
    posts.data.forEach(post => {
        output += `
        <tr>
            <td>${post.title}</td>
            <td>${post.description}</td>
            <td>${post.date}</td>
            <td>
                <button type="button" class="btn btn-warning btn-sm">Edit</button>
                <button type="button" class="btn btn-danger btn-sm">Delete</button>
            </td>
        </tr>
        `;
    });
    document.getElementById("posts").innerHTML = output;
}
axios
.get('/api/posts')
.then(displayPosts)
.catch( err => { console.log(err);});



const express = require('express');
const { authenticationMiddleware } = require('./middleware/auth');
// const userRouter = require('./routes/user');
// const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth.routes');
const studentsRouter = require('./routes/students.routes');
const instituteRouter = require('./routes/institute.routes');
const facultyRouter = require('./routes/faculty.routes');

const app = express();

const PORT = process.env.PORT || 8000;
app.use(express.json());

// app.use(authenticationMiddleware);

  




app.get('/', (req, res) => {
    res.status(200).json('server running ');
});

app.use('/auth', authRouter  );
app.use('/students', studentsRouter );
app.use('/institutes', instituteRouter);
app.use('/faculty', facultyRouter);


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

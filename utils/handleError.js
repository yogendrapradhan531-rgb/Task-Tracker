// Converts Mongoose errors into HTTP responses
module.exports = (res, error) => {
  if (error.name === 'ValidationError') {
    const msg = Object.values(error.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ success: false, message: msg });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${error.path}` });
  }
  console.error(error);
  res.status(500).json({ success: false, message: 'Server error' });
};

import * as Yup from "yup";

const signinValidationSchema = Yup.object({
  email: Yup.string()
    .email("Please enter a valid email")
    .matches(
      /^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/,
      "Not a proper email"
    )
    .required("Email required"),
  password: Yup.string().required("Password required"),
});

export default signinValidationSchema;

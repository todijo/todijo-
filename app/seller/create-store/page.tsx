export default function CreateStorePage() {
  return (
    <main
      style={{
        maxWidth: "700px",
        margin: "60px auto",
        padding: "20px",
      }}
    >
      <h1>🏪 Create your store</h1>
      <p>Create your Todijo shop in a few seconds.</p>

      <form style={{ display: "grid", gap: "16px", marginTop: "30px" }}>
        <input
          type="text"
          placeholder="Store name"
          style={{ padding: "14px", fontSize: "16px" }}
        />

        <input
          type="text"
          placeholder="Country"
          style={{ padding: "14px", fontSize: "16px" }}
        />

        <input
          type="text"
          placeholder="City"
          style={{ padding: "14px", fontSize: "16px" }}
        />

        <textarea
          placeholder="Store description"
          rows={5}
          style={{ padding: "14px", fontSize: "16px" }}
        />

        <button
          type="submit"
          style={{
            background: "#0f8b5f",
            color: "white",
            border: "none",
            padding: "16px",
            borderRadius: "10px",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          Create Store
        </button>
      </form>
    </main>
  );
}


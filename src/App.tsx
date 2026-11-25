import { BrowserRouter, Route, Routes } from "react-router-dom";
import { EditSetPage } from "./pages/EditSetPage";
import { HomePage } from "./pages/HomePage";
import { NewSetPage } from "./pages/NewSetPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PracticePage } from "./pages/PracticePage";
import { ResultsPage } from "./pages/ResultsPage";
import { SamplePage } from "./pages/SamplePage";
import { SetPage } from "./pages/SetPage";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sets/new" element={<NewSetPage />} />
        <Route path="/sets/:setId" element={<SetPage />} />
        <Route path="/sets/:setId/edit" element={<EditSetPage />} />
        <Route path="/practice/:sessionId" element={<PracticePage />} />
        <Route path="/results/:sessionId" element={<ResultsPage />} />
        <Route path="/sample" element={<SamplePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

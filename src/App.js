import React, { Component } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import Home from "./Pages/Home";
import AdminPanel from "./Pages/adminPanel";
import UserPanel from "./Pages/userPanel";
 
function App() {

	return (
		<div>
			<BrowserRouter>
				<Routes>

					<Route path='/' element={<Home />} />
					<Route path='admin-panel' element={<AdminPanel />} />
					<Route path='user-panel' element={<UserPanel />} />
  
				</Routes>
			</BrowserRouter>
			<div>
		

			</div>
		</div>




	)
}


export default App;

// static/dashboard_app/js/chartQ13.js

async function drawChartQ13(containerSelector, tooltipElement, dataPath) {
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    if (!dataPath) {
        vizContainer.html("<p style='color:red;'>Lỗi: Đường dẫn dữ liệu (dataPath) cho biểu đồ Q13 không được cung cấp.</p>");
        console.error("Lỗi drawChartQ13: dataPath không được định nghĩa.");
        return;
    }

    try {
        console.log(`DEBUG Q13: Bắt đầu vẽ biểu đồ. Container: ${containerSelector}, DataPath: ${dataPath}`);
        const allData = await d3.csv(dataPath);

        if (!allData || allData.length === 0) {
            console.error(`DEBUG Q13: CSV tải về rỗng hoặc null từ ${dataPath}. Số hàng: ${allData ? allData.length : 'null/undefined'}`);
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }
        console.log("DEBUG Q13: Dữ liệu thô đã tải thành công. Tổng số hàng:", allData.length);
        console.log("DEBUG Q13: 5 hàng dữ liệu thô đầu tiên:", allData.slice(0, 5));

        // 1. XỬ LÝ DỮ LIỆU:
        allData.forEach(d => {
            d.Profit = parseFloat(d.Profit);
            d.Discount = parseFloat(d.Discount);
            
            // Xử lý giá trị không phải số hoặc nằm ngoài khoảng hợp lệ
            if (isNaN(d.Profit)) d.Profit = 0;
            if (isNaN(d.Discount) || d.Discount < 0 || d.Discount > 1) d.Discount = 0;

            // Đảm bảo cột 'Sub-Category' tồn tại và không rỗng
            // (Kiểm tra lại tên cột trong CSV của bạn: 'Sub-Category' hay 'Sub Category' hay 'subcategory'?)
            if (typeof d['Sub-Category'] === 'undefined' || d['Sub-Category'] === null || String(d['Sub-Category']).trim() === "") {
                d['Sub-Category'] = "Không xác định";
            }
        });
        console.log("DEBUG Q13: Đã xử lý và làm sạch dữ liệu ban đầu.");


        // Gom nhóm theo Sub-Category, tính tổng Profit và trung bình Discount
        const groupedBySubCategory = d3.rollup(allData,
            v => ({
                Total_Profit: d3.sum(v, d => d.Profit),
                Average_Discount: d3.mean(v, d => d.Discount)
            }),
            d => d['Sub-Category'] // Đảm bảo tên cột này chính xác trong CSV
        );
        console.log("DEBUG Q13: Đã gom nhóm dữ liệu theo Sub-Category. Số lượng nhóm:", groupedBySubCategory.size);
        console.log("DEBUG Q13: Dữ liệu sau gom nhóm (Map):", groupedBySubCategory);


        let dataForChart = Array.from(groupedBySubCategory, ([key, value]) => ({
            'Sub-Category': key,
            Total_Profit: value.Total_Profit || 0, // Đảm bảo là số, tránh NaN
            Average_Discount_Ratio: value.Average_Discount || 0 // Đảm bảo là số, tránh NaN
        }));
        console.log("DEBUG Q13: dataForChart sau khi chuyển sang Array. Tổng số mục:", dataForChart.length);
        console.log("DEBUG Q13: 5 mục đầu tiên của dataForChart:", dataForChart.slice(0, 5));

        // Lọc bỏ các Sub-Category không hợp lệ hoặc có giá trị Total_Profit/Average_Discount_Ratio là NaN/Infinity
        dataForChart = dataForChart.filter(d => 
            d['Sub-Category'] !== "Không xác định" &&
            !isNaN(d.Total_Profit) && isFinite(d.Total_Profit) && // Kiểm tra cả isFinite
            !isNaN(d.Average_Discount_Ratio) && isFinite(d.Average_Discount_Ratio)
        );
        console.log("DEBUG Q13: dataForChart sau khi lọc. Số mục còn lại:", dataForChart.length);
        console.log("DEBUG Q13: 5 mục đầu tiên của dataForChart sau lọc:", dataForChart.slice(0, 5));
        
        dataForChart.sort((a, b) => d3.ascending(a['Sub-Category'], b['Sub-Category']));
        console.log("DEBUG Q13: dataForChart sau khi sắp xếp:", dataForChart);


        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Sub-Category hợp lệ (lợi nhuận/chiết khấu là số) để vẽ biểu đồ Q13.</p>");
            console.warn("DEBUG Q13: dataForChart rỗng sau tất cả các bước xử lý. Biểu đồ không được vẽ.");
            return;
        }

        // --- BẮT ĐẦU CODE D3.JS VẼ SCATTER PLOT ---
        console.log("DEBUG Q13: Bắt đầu quá trình vẽ D3.");
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.98 : 600;
        const baseHeight = 450;

        const chartWidth = Math.max(400, baseWidth);
        const chartHeight = Math.max(300, baseHeight);
        
        const margin = { top: 50, right: 50, bottom: 60, left: 70 };

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis (Average Discount - tỷ lệ 0-1, hiển thị dạng %)
        const xMinDiscount = d3.min(dataForChart, d => d.Average_Discount_Ratio);
        const xMaxDiscount = d3.max(dataForChart, d => d.Average_Discount_Ratio);
        
        // ĐÃ SỬA: Cải thiện domain cho trục X để xử lý min/max bằng 0 hoặc NaN
        const xDomainMin = (xMinDiscount !== undefined && xMinDiscount !== null && !isNaN(xMinDiscount)) ? xMinDiscount * 0.95 : -0.01;
        const xDomainMax = (xMaxDiscount !== undefined && xMaxDiscount !== null && !isNaN(xMaxDiscount)) ? xMaxDiscount * 1.05 : 0.8;
        
        const x = d3.scaleLinear()
            .domain([Math.min(xDomainMin, 0), Math.max(xDomainMax, 0.01)]) // Đảm bảo domain có khoảng cách và chứa 0
            .range([0, width]);
        console.log(`DEBUG Q13: X-axis domain: [${x.domain()[0]}, ${x.domain()[1]}]`);


        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".0%"))) // Hiển thị dạng % (0%, 10%,...)
            .selectAll("text")
                .style("font-size", "10px");
        
        svg.append("text") // Nhãn trục X
            .attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom * 0.7)
            .style("font-size", "12px").style("fill", "#333")
            .text("Chiết khấu trung bình (Avg Discount %)");


        // Y Axis (Total Profit - có thể âm)
        const yMinProfit = d3.min(dataForChart, d => d.Total_Profit);
        const yMaxProfit = d3.max(dataForChart, d => d.Total_Profit);
        
        // ĐÃ SỬA: Cải thiện domain cho trục Y để xử lý min/max bằng 0 hoặc NaN
        const yDomainMin = (yMinProfit !== undefined && yMinProfit !== null && !isNaN(yMinProfit)) ? yMinProfit * 1.1 : -100;
        const yDomainMax = (yMaxProfit !== undefined && yMaxProfit !== null && !isNaN(yMaxProfit)) ? yMaxProfit * 1.1 : 100;
        
        const y = d3.scaleLinear()
            .domain([Math.min(yDomainMin, 0), Math.max(yDomainMax, 0.01)]) // Đảm bảo domain có khoảng cách và chứa 0
            .range([height, 0]);
        console.log(`DEBUG Q13: Y-axis domain: [${y.domain()[0]}, ${y.domain()[1]}]`);

        svg.append("g")
            .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("$,.0s"))) // Định dạng tiền tệ
            .selectAll("text")
                .style("font-size", "10px");

        svg.append("text") // Nhãn trục Y
            .attr("transform", "rotate(-90)").attr("y", -margin.left + 15).attr("x", -height / 2)
            .attr("dy", "1em").style("text-anchor", "middle").style("font-size", "12px").style("fill", "#333")
            .text("Tổng Lợi nhuận ($)");
            
        // Đường tham chiếu 0 cho Lợi nhuận (trục ngang)
        if (y.domain()[0] < 0 && y.domain()[1] > 0) { // Kiểm tra domain có chứa 0
            svg.append("line")
                .attr("x1", 0).attr("x2", width)
                .attr("y1", y(0)).attr("y2", y(0))
                .attr("stroke", "#bdbdbd").attr("stroke-width", 1).attr("stroke-dasharray", "3,3");
        }
        
        // Vẽ các điểm (circles)
        const dots = svg.append('g')
            .selectAll("circle.dot-Q13")
            .data(dataForChart)
            .join("circle") // Sử dụng .join() thay vì .enter().append()
              .attr("class", "dot-Q13")
              .attr("cx", d => x(d.Average_Discount_Ratio))
              .attr("cy", d => y(d.Total_Profit))
              .attr("r", 5) // Kích thước điểm
              .style("fill", "#69b3a2") // Màu điểm (xanh lá nhạt)
              .attr("opacity", 0.7)
              .style("cursor", "pointer");

        // Thêm nhãn text cho từng điểm (tên Sub-Category)
        svg.append('g')
            .selectAll("text.label-Q13")
            .data(dataForChart)
            .join("text") // Sử dụng .join()
            .attr("class", "label-Q13")
            .attr("x", d => x(d.Average_Discount_Ratio) + 7)
            .attr("y", d => y(d.Total_Profit) + 3)
            .text(d => d['Sub-Category'])
            .style("font-size", "8px")
            .style("fill", "#555");
        
        // Tooltip
        dots
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>${d['Sub-Category']}</strong><br/>
                     Chiết khấu TB: ${(d.Average_Discount_Ratio * 100).toFixed(1)}%<br/>
                     Tổng Lợi nhuận: $${d.Total_Profit.toLocaleString(undefined, {maximumFractionDigits:0})}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).transition().duration(100).attr("r", 7).style("filter", "brightness(1.2)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).transition().duration(100).attr("r", 5).style("filter", "brightness(1)");
            });

        // Tiêu đề cho biểu đồ
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - (margin.top / 2)) 
            .attr("text-anchor", "middle")
            .style("font-size", "15px").style("font-weight", "bold").style("fill", "#333")
            .text("Tương quan Lợi nhuận và Chiết khấu theo Sub-Category"); 
            
        // Grid lines (tùy chọn)
        svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(6).tickSize(-height).tickFormat(""));

        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""));
        
        svg.selectAll(".grid line").style("stroke", "#e0e0e0").style("stroke-opacity", 0.7).style("shape-rendering", "crispEdges");
        svg.selectAll(".grid path").style("stroke-width", 0);


    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q13: ${error.message}</p>`);
        console.error("Lỗi drawChartQ13 (catch block):", error);
    }
}
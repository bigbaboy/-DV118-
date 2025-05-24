// chartTQ2.js

async function drawChartTQ2(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: Thêm dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. XỬ LÝ DỮ LIỆU:
        allData.forEach(d => {
            d.Sales = parseFloat(d.Sales);
            if (isNaN(d.Sales) || d.Sales < 0) d.Sales = 0;
            // (Kiểm tra lại tên cột trong CSV của bạn, có thể là 'Sub-Category' viết hoa chữ S, hoặc khác)
            if (typeof d['Sub-Category'] === 'undefined' || d['Sub-Category'] === null || String(d['Sub-Category']).trim() === "") {
                d['Sub-Category'] = "Không xác định";
            }
        });

        // Gom nhóm theo Sub-Category, tính tổng Sales
        const salesBySubCategoryRollup = d3.rollup(allData,
            v => d3.sum(v, d => d.Sales),
            d => d['Sub-Category'] // Đảm bảo tên cột này chính xác trong CSV
        );

        let dataForChart = Array.from(salesBySubCategoryRollup, ([key, value]) => ({
            'Sub-Category': key,
            Total_Sales: value || 0
        }));

        // Lọc bỏ các Sub-Category có Sales <= 0 hoặc không có tên
        dataForChart = dataForChart.filter(d => d.Total_Sales > 0 && d['Sub-Category'] !== "Không xác định");
        
        // ĐÃ SỬA: Chỉ giữ lại một lần sắp xếp để thanh dài nhất ở trên cùng
        dataForChart.sort((a, b) => a.Total_Sales - b.Total_Sales); // Sắp xếp tăng dần để thanh dài nhất ở trên với range [height,0]
        
        // Bạn có thể lấy top N ở đây nếu muốn, ví dụ: dataForChart = dataForChart.slice(0, 15);

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Sub-Category hợp lệ để vẽ biểu đồ TQ2.</p>");
            return;
        }
        // console.log("Data for Sub-Category Sales Bar Chart (TQ2):", dataForChart);

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT NGANG ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.98 : 700;
        // Chiều cao động dựa trên số lượng Sub-Category
        const barHeightUnitTQ2 = 25; // Chiều cao ước tính cho mỗi thanh + padding
        const baseHeight = dataForChart.length * barHeightUnitTQ2 + 100; // 100 cho top/bottom margins + title

        const chartWidth = Math.max(400, baseWidth);
        const chartHeight = Math.max(300, baseHeight); 
        
        const margin = { top: 50, right: 50, bottom: 50, left: 150 }; // Tăng left margin cho tên Sub-Category dài

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Y Axis (Tên Sub-Category)
        const y = d3.scaleBand()
            .range([height, 0]) // Đảo range để Sub-Category có Sales cao nhất (sau sort tăng dần) ở trên cùng
            .domain(dataForChart.map(d => d['Sub-Category']))
            .padding(0.15); 

        svg.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(6))
            .selectAll("text")
                .style("font-size", "9px");
        
        svg.append("text") // Nhãn trục Y
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left + 15) 
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle").style("font-size", "11px").style("fill", "#333")
            .text("Danh mục sản phẩm con");

        // X Axis (Doanh thu)
        const xMaxSalesTQ2 = d3.max(dataForChart, d => d.Total_Sales);
        const x = d3.scaleLinear()
            .domain([0, xMaxSalesTQ2 > 0 ? xMaxSalesTQ2 * 1.05 : 1000]) 
            .range([0, width]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(Math.min(6, width/80)).tickFormat(d3.format("~s"))) 
            .selectAll("text")
                .style("font-size", "9px");
        
        svg.append("text") // Nhãn trục X
            .attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom * 0.8)
            .style("font-size", "11px").style("fill", "#333")
            .text("Doanh thu ($)");

        // Color Scale (Tương tự palette 'plasma' của Seaborn)
        // D3 có d3.interpolatePlasma. Chúng ta sẽ dùng nó với scaleSequential.
        const colorPlasma = d3.scaleSequential(d3.interpolatePlasma)
                               .domain([0, xMaxSalesTQ2]); // Màu dựa trên giá trị Sales

        // Vẽ các thanh ngang
        const barsTQ2 = svg.selectAll(".bar-tq2-subcategory")
            .data(dataForChart)
            .join("rect")
              .attr("class", "bar-tq2-subcategory")
              .attr("y", d => y(d['Sub-Category']))
              .attr("x", x(0)) 
              .attr("width", d => x(d.Total_Sales)) 
              .attr("height", y.bandwidth())
              .attr("fill", d => colorPlasma(d.Total_Sales)) 
              .style("cursor", "pointer");

        // Thêm text giá trị Sales trên hoặc gần mỗi thanh (tùy chọn)
        svg.selectAll(".bar-value-tq2")
            .data(dataForChart)
            .join("text")
            .attr("class", "bar-value-tq2")
            .attr("x", d => x(d.Total_Sales) + 5) 
            .attr("y", d => y(d['Sub-Category']) + y.bandwidth() / 2)
            .attr("dy", "0.35em") 
            .style("text-anchor", "start") 
            .style("font-size", "9px")
            .style("fill", d => d3.hsl(colorPlasma(d.Total_Sales)).l < 0.5 ? "#eee" : "#333") // Màu chữ tương phản
            .text(d => `$${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}`);
        
        // Tooltip
        barsTQ2
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Sub-Category: ${d['Sub-Category']}</strong><br/>
                     Doanh thu: $${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).style("filter", "brightness(1.2)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });

        // Tiêu đề cho biểu đồ
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - (margin.top / 2)) 
            .attr("text-anchor", "middle")
            .style("font-size", "16px").style("font-weight", "bold").style("fill", "#333")
            .text("Doanh thu theo Danh mục Sản phẩm con"); // ĐÃ SỬA: Thêm tiêu đề

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ TQ2: ${error.message}</p>`);
        console.error("Lỗi drawChartTQ2:", error);
    }
}
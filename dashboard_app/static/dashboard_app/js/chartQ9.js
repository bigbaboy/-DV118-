// chartQ9.js

async function drawChartQ9(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: Thêm dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. DATA PROCESSING
        allData.forEach(d => {
            d.Sales = parseFloat(d.Sales); // Chuyển Sales sang số
            if (isNaN(d.Sales) || d.Sales < 0) d.Sales = 0;
            // (Kiểm tra lại tên cột trong CSV của bạn, có thể là 'category' thay vì 'Category')
            if (typeof d.Category === 'undefined' || d.Category === null || String(d.Category).trim() === "") {
                d.Category = "Không xác định"; // Default for missing Category
            }
        });

        // ***** SỬA LỖI: TÍNH totalRevenue Ở ĐÂY *****
        const totalRevenue = d3.sum(allData, d => d.Sales);

        if (isNaN(totalRevenue) || totalRevenue <= 0) {
            vizContainer.html("<p>Tổng doanh thu không hợp lệ hoặc bằng 0. Không thể vẽ biểu đồ tỷ lệ cho Q9.</p>");
            console.error("Total revenue for Q9 is invalid or zero:", totalRevenue);
            return;
        }

        const salesByCategoryRollup = d3.rollup(allData,
            v => d3.sum(v, d => d.Sales),
            d => d.Category
        );

        let dataForChart = Array.from(salesByCategoryRollup, ([key, value]) => ({
            Category: key,
            Sales: value || 0,
            // Sử dụng totalRevenue đã được tính ở trên
            Percentage: (value || 0) / totalRevenue * 100
        }));

        dataForChart = dataForChart.filter(d => d.Sales > 0 && d.Category !== "Không xác định" && !isNaN(d.Percentage));
        dataForChart.sort((a, b) => b.Sales - a.Sales);

        if (dataForChart.length === 0) {
            vizContainer.html("<p>No valid Category data (sales > 0) to draw Chart Q9.</p>");
            return;
        }
        // console.log("Data for Pie Chart Q9 (Category Sales):", dataForChart);

        // --- START D3.JS PIE CHART DRAWING ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseDimension = Math.min(containerRect.width > 0 ? containerRect.width * 0.95 : 400, 400);
        
        const width = baseDimension;
        const height = baseDimension; 
        const margin = { top: 60, right: 40, bottom: 60, left: 40 };

        const effectiveDiameter = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom);
        let radius = effectiveDiameter / 2;
        if (radius < 30) radius = 30;

        const innerRadius = 0; // Pie Chart
        const outerRadius = radius * 0.9;

        const svg = vizContainer.append("svg")
            .attr("width", width)
            .attr("height", height + margin.top) 
            .append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2 + margin.top / 2})`);

        const color = d3.scaleOrdinal()
            .domain(dataForChart.map(d => d.Category))
            .range(d3.schemeSet2);

        // Matplotlib startangle=140. D3 pie starts at 12 o'clock and goes clockwise.
        // 140 degrees CCW from East (Matplotlib) is -50 degrees from North for D3 (or 310 degrees).
        // We can use startAngle and endAngle to try and mimic this.
        // Simpler: D3's startAngle is relative to 12 o'clock.
        // Matplotlib's startangle=140 means the first slice starts at 140 deg CCW from the +X axis.
        // This is 140-90 = 50 deg CCW from +Y axis.
        // For D3, 0 is +Y. So, -50 deg or +310 deg.
        const pie = d3.pie()
            .value(d => d.Sales)
            .sort(null) // Keep order from dataForChart (sorted by Sales)
            .padAngle(0.01)
            .startAngle( (-50 * Math.PI / 180) ) // -50 degrees in radians
            .endAngle( (-50 * Math.PI / 180) + (2 * Math.PI) );


        const data_ready = pie(dataForChart);

        const arcPath = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        const outerArcForLabels = d3.arc()
            .innerRadius(outerRadius * 1.1) // Labels further out
            .outerRadius(outerRadius * 1.1);

        // Slices
        const slices = svg.selectAll('g.slice-q9')
            .data(data_ready)
            .join('g')
              .attr('class', 'slice-q9')
              .style("cursor", "pointer");

        slices.append('path')
            .attr('d', arcPath)
            .attr('fill', d => color(d.data.Category))
            .attr("stroke", "white")
            .style("stroke-width", "1px");

        // Labels (Category and Percentage) - Placed outside with polylines
        const labelLines = svg.selectAll("polyline.label-line-q9")
            .data(data_ready)
            .join("polyline")
            .filter(d => (d.endAngle - d.startAngle) > 0.1) // Chỉ vẽ cho miếng đủ lớn
            .attr("class", "label-line-q9")
            .style("fill", "none")
            .attr("stroke", d => d3.rgb(color(d.data.Category)).darker(0.3))
            .attr("stroke-width", 1)
            .attr("points", function(d) {
                const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                const posA = arcPath.centroid(d); // Điểm trung tâm của cung trên pie
                const posB = outerArcForLabels.centroid(d); // Điểm trung tâm của cung ngoài
                
                // ĐÃ SỬA: Tính toán vị trí điểm C (điểm cuối cùng của polyline) chuẩn hơn
                const xC = outerRadius * 1.25 * Math.cos(midangle);
                const yC = outerRadius * 1.25 * Math.sin(midangle);
                
                return [posA, posB, [xC, yC]]; // Đường gấp khúc
            });

        const labelTexts = svg.selectAll("text.label-text-q9")
            .data(data_ready)
            .join("text")
            .filter(d => (d.endAngle - d.startAngle) > 0.1) 
            .attr("class", "label-text-q9")
            .html(d => {
                const percentage = d.data.Percentage; // Lấy từ dataForChart
                return `<tspan style="font-weight:bold;">${d.data.Category}</tspan> <tspan style="font-size:0.9em">(${percentage.toFixed(1)}%)</tspan>`;
            })
            .attr('transform', function(d) {
                const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                // Vị trí text (tương tự như điểm C của polyline)
                const xPos = outerRadius * 1.3 * Math.cos(midangle); // Hơi xa hơn posC
                const yPos = outerRadius * 1.3 * Math.sin(midangle);
                return `translate(${xPos}, ${yPos})`;
            })
            .style('text-anchor', function(d) {
                const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                // Nếu góc giữa của miếng bánh nằm ở nửa bên phải (từ -90 đến 90 độ), căn trái, ngược lại căn phải
                return (midangle > -Math.PI / 2 && midangle < Math.PI / 2) ? 'start' : 'end';
            })
            .style("font-size", "10px")
            .style("fill", d => d3.rgb(color(d.data.Category)).darker(0.7));
        
        // Tooltip
        slices
            .on("mouseover", function(event, d_pie) {
                const d_data = d_pie.data;
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Danh mục: ${d_data.Category}</strong><br/>
                     Doanh thu: $${d_data.Sales.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                     Tỷ lệ: ${d_data.Percentage.toFixed(1)}%`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).select("path")
                  .transition().duration(100)
                  .attr("d", d3.arc().innerRadius(innerRadius).outerRadius(outerRadius * 1.05).padAngle(0.01).cornerRadius(3)(d_pie) );
            })
            .on("mouseout", function(event, d_pie) { 
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).select("path")
                  .transition().duration(100)
                  .attr("d", arcPath(d_pie)); 
            });

        // Title
        svg.append("text")
            .attr("x", 0) 
            .attr("y", -height / 2 - margin.top / 2 + 10) // Đẩy tiêu đề lên cao hơn nữa
            .attr("text-anchor", "middle")
            .style("font-size", "15px").style("font-weight", "bold").style("fill", "#333")

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q9 (Pie Chart): ${error.message}</p>`);
        console.error("Lỗi drawChartQ9:", error);
    }
}